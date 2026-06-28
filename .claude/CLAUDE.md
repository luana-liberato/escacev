# CLAUDE.md — Escacev (Sistema de Gestão de Escalas)

> Leia este arquivo no início de toda sessão de Claude Code.
> Ele define stack, padrões, regras de negócio e o que nunca fazer.

---

## 1. Visão Geral

Sistema web de gestão de escalas para grupos de voluntários em igrejas/instituições.

**MVP (este ciclo):** operação com uma única instituição pré-cadastrada via seed.
Sem tela de cadastro de nova instituição — o `instituicaoId` é fixo, lido do `.env`.

**Futuro (v2):** expansão multitenant sem refatoração de schema. O `instituicaoId`
já existe em todas as tabelas; basta implementar o onboarding. Duas formas de
ingresso em um tenant serão suportadas: **convite por e-mail** (admin convida
uma pessoa específica) e **código de acesso** (admin gera um código compartilhável;
qualquer pessoa com o código pode entrar no tenant digitando-o na tela de acesso).

**Perfis de usuário:**
- `ADMIN_GERAL` — gerencia membros, ministérios e calendário da instituição
- `ADMIN_MINISTERIO` — gerencia escalas e membros do seu ministério
- `MEMBRO` — visualiza escalas, registra indisponibilidades, participa de trocas

---

## 2. Stack

| Camada | Tecnologia |
|--------|-----------|
| Back-end | Node.js 20 + Express |
| Front-end | React 18 + Tailwind CSS |
| Banco | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Google OAuth 2.0 + JWT stateless + bcrypt |
| E-mail | Nodemailer + Mailtrap (dev) / SendGrid (prod) |
| Deploy | Docker + Docker Compose + nginx + Let's Encrypt |
| Lint | ESLint + Prettier |

---

## 3. Estrutura de Pastas

```
escacev/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── domain/
│       │   ├── entities/        # Entidades com construtor privado + create()
│       │   └── use-cases/       # Um arquivo por caso de uso
│       ├── infra/
│       │   ├── database/        # PrismaClient singleton, repositórios
│       │   ├── http/
│       │   │   ├── controllers/
│       │   │   ├── middlewares/  # auth.ts, rbac.ts, errorHandler.ts
│       │   │   └── routes/
│       │   └── services/        # email.ts, oauth.ts
│       └── shared/
│           ├── errors/          # AppError com statusCode
│           └── utils/           # asyncHandler.ts, respond.ts
├── web/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── services/            # Chamadas axios à API
└── docker-compose.yml
```

---

## 4. Padrões de Código

### 4.1 Entidades — Construtor Privado + Factory Static

```typescript
// ✅ CORRETO — sempre assim
class Ministerio {
  private constructor(
    public readonly id: string,
    public readonly nome: string,
    public readonly instituicaoId: string,
    public readonly criadoEm: Date,
  ) {}

  static create(props: { nome: string; instituicaoId: string }): Ministerio {
    if (!props.nome?.trim()) throw new AppError('Nome é obrigatório', 400);
    return new Ministerio(cuid(), props.nome.trim(), props.instituicaoId, new Date());
  }
}

// ❌ ERRADO — nunca construtor público em entidades de domínio
class Ministerio {
  constructor(public nome: string) {}
}
```

### 4.2 Injeção de Dependência

```typescript
// Use cases recebem dependências via construtor — nunca importam diretamente
class CriarMinisterioUseCase {
  constructor(private readonly ministerioRepo: MinisterioRepository) {}

  async execute(dto: { nome: string; instituicaoId: string }) {
    const ministerio = Ministerio.create(dto);
    return this.ministerioRepo.save(ministerio);
  }
}

// No controller, instanciar assim:
const useCase = new CriarMinisterioUseCase(new PrismaMinisterioRepository());
```

### 4.3 asyncHandler — Toda rota usa este wrapper

```typescript
// src/shared/utils/asyncHandler.ts
import { RequestHandler } from 'express';
export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Nas rotas — nunca omitir:
router.post('/ministerios', auth, rbac('ADMIN_GERAL'), asyncHandler(controller.criar));
```

### 4.4 Formato de Resposta da API

```typescript
// SEMPRE este shape — nunca inventar outro formato
// Sucesso:
res.status(201).json({ success: true,  data: ministerio, message: 'Ministério criado' });
// Erro:
res.status(400).json({ success: false, data: null,       message: 'Nome é obrigatório' });
```

### 4.5 Tenant via JWT — Regra de Ouro

```typescript
// O instituicaoId NUNCA vem no body da request — sempre do token JWT
const { instituicaoId, membroId, perfil } = req.user; // injetado pelo middleware auth

// ❌ NUNCA fazer isso:
const { instituicaoId } = req.body;
```

---

## 5. Autenticação e RBAC

**Único método de login: Google OAuth 2.0.** Não existe cadastro por e-mail/senha.

```typescript
// Middleware auth: valida JWT → injeta req.user = { membroId, instituicaoId, perfil }
// Middleware rbac: verifica se req.user.perfil está na lista permitida

// Exemplos de uso nas rotas:
router.get('/membros',   auth, rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'), asyncHandler(...));
router.post('/escalas',  auth, rbac('ADMIN_MINISTERIO'),                 asyncHandler(...));
router.get('/minhas-escalas', auth,                                      asyncHandler(...));

// Google OAuth flow:
// GET /auth/google          → redireciona para consent screen
// GET /auth/google/callback → troca code por tokens → cria/vincula Conta + Membro → JWT
```

---

## 6. Regras de Negócio

| Código | Regra |
|--------|-------|
| RN01 | **Conflito** = sobreposição de horário no mesmo membro + funções incompatíveis |
| RN02 | **Compatibilidade** = par em `CompatibilidadeFuncao`; ausência = incompatível. Armazenar sempre com `funcaoAId < funcaoBId` |
| RN03 | Admin pode confirmar alocação com conflito; `alocacao.conflito = true` fica registrado |
| RN04 | Escala com `status = RASCUNHO` é invisível ao membro; só aparece após `PUBLICADA` |
| RN05 | Alertar ao escalar membro com `Indisponibilidade` no período; admin pode ignorar |
| RN06 | Sobrecarga: membro ultrapassa N escalas no mês (N configurável pela instituição) |
| RN07 | Em conflito entre escalas, prevalece a com `publicadaEm` mais antiga |
| RN08 | Troca/cobertura só válida entre membros do mesmo ministério + confirmação do admin |

**Lógica do motor de conflito (RN01):**
```
Para cada nova alocacao(membroId, vagaId):
  1. Buscar todas as alocacoes existentes do membro
  2. Para cada alocacao_existente:
     - Checar sobreposição: evento_novo.inicio < alocacao_existente.evento.fim
                        AND evento_novo.fim   > alocacao_existente.evento.inicio
     - Se sobrepõe: checar compatibilidade de funcoes
     - Se funções incompatíveis: conflito detectado → retornar alerta com detalhes
```

---

## 7. Seed — MVP Single-Institution

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.instituicao.upsert({
    where:  { id: process.env.INSTITUTION_ID ?? 'inst-escacev' },
    update: {},
    create: {
      id:   process.env.INSTITUTION_ID  ?? 'inst-escacev',
      nome: process.env.INSTITUTION_NAME ?? 'Minha Igreja',
    },
  });
  console.log('Seed concluído: instituição criada.');
}

main().finally(() => prisma.$disconnect());
```

---

## 8. Variáveis de Ambiente (.env)

```env
# Banco
DATABASE_URL="postgresql://escacev:escacev@localhost:5432/escacev"

# JWT
JWT_SECRET="troque-por-um-secret-longo-e-aleatorio"
JWT_EXPIRES_IN="7d"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:3001/auth/google/callback"

# Instituição (MVP single-institution)
INSTITUTION_ID="inst-escacev"
INSTITUTION_NAME="Nome da Igreja"

# E-mail (dev = Mailtrap, prod = SendGrid)
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
FROM_EMAIL="noreply@escacev.app"

# App
PORT=3001
NODE_ENV=development
```

---

## 9. Comandos do Dia a Dia

```bash
# Desenvolvimento
cd api  && npm run dev
cd web  && npm run dev

# Banco de dados
npx prisma migrate dev --name descricao_da_migration
npx prisma db seed
npx prisma studio

# Qualidade (obrigatório antes de cada commit)
npm run lint

# Docker
docker compose up -d        # sobe tudo
docker compose logs -f api  # logs da api
docker compose down         # desce tudo
```

---

## 10. O que NUNCA Fazer

- Nunca receber `instituicaoId` no body — sempre do JWT (`req.user`)
- Nunca expor `hashSenha` em nenhuma resposta da API
- Nunca usar formato de resposta diferente de `{ success, data, message }`
- Nunca usar construtor público em entidades de domínio
- Nunca omitir `asyncHandler` em rotas — exceções não tratadas derrubam o servidor
- Nunca fazer lógica de negócio no controller — pertence ao use case
- Nunca importar o PrismaClient diretamente no use case — sempre via repositório injetado
