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

**Perfis de usuário (papel global):**
- `ADMIN_GERAL` — gerencia membros, ministérios e calendário da instituição inteira
- `ADMIN_MINISTERIO` — administra um ou mais ministérios específicos (ver "papel por ministério")
- `MEMBRO` — visualiza escalas, registra indisponibilidades, participa de trocas

**Papel por ministério:** o vínculo membro↔ministério é a tabela `MembroMinisterio`.
Existir uma linha nessa tabela significa que o membro **participa** daquele ministério
(pode ser escalado). A coluna `isAdmin` (boolean) indica se, além de participar, o membro
também **administra** aquele ministério. Consequências:
- Um membro pode administrar **vários** ministérios (várias linhas com `isAdmin = true`).
- Um admin de ministério **também pode ser escalado** (a associação já garante isso).
- Permissão **escopada**: editar um ministério ou suas escalas exige `isAdmin = true`
  *naquele* ministério — não basta ter o papel global `ADMIN_MINISTERIO`.
- O `ADMIN_GERAL` tem poder sobre todos os ministérios pelo papel global.

---

## 2. Stack

| Camada | Tecnologia |
|--------|-----------|
| Back-end | Node.js 20 + Express |
| Front-end | React 18 + Tailwind CSS |
| Banco | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Google OAuth 2.0 + JWT stateless |
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
│       │   ├── repositories/    # Interfaces (contratos) dos repositórios
│       │   └── use-cases/       # Um arquivo por caso de uso
│       ├── infra/
│       │   ├── database/        # PrismaClient singleton
│       │   │   └── repositories/ # Implementações Prisma (tradução PT↔EN)
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
// ✅ CORRETO — sempre assim (propriedades em inglês; mensagens em português)
class Ministry {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly institutionId: string,
    public readonly createdAt: Date,
  ) {}

  static create(props: { name: string; institutionId: string }): Ministry {
    if (!props.name?.trim()) throw new AppError('Nome é obrigatório', 400);
    return new Ministry(cuid(), props.name.trim(), props.institutionId, new Date());
  }
}

// ❌ ERRADO — nunca construtor público em entidades de domínio
class Ministry {
  constructor(public name: string) {}
}
```

### 4.2 Injeção de Dependência

```typescript
// Use cases recebem dependências via construtor — nunca importam diretamente
class CreateMinistryUseCase {
  constructor(private readonly ministryRepo: MinistryRepository) {}

  async execute(dto: { name: string; institutionId: string }) {
    const ministry = Ministry.create(dto);
    return this.ministryRepo.save(ministry);
  }
}

// No controller, instanciar assim:
const useCase = new CreateMinistryUseCase(new PrismaMinistryRepository());
```

### 4.3 asyncHandler — Toda rota usa este wrapper

```typescript
// src/shared/utils/asyncHandler.ts
import { RequestHandler } from 'express';
export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Nas rotas — nunca omitir:
router.post('/ministerios', auth, rbac('ADMIN_GERAL'), asyncHandler(controller.create));
```

### 4.4 Formato de Resposta da API

```typescript
// SEMPRE este shape — nunca inventar outro formato
// Sucesso:
res.status(201).json({ success: true,  data: ministry, message: 'Ministério criado' });
// Erro:
res.status(400).json({ success: false, data: null,       message: 'Nome é obrigatório' });
```

### 4.5 Tenant via JWT — Regra de Ouro

```typescript
// O institutionId NUNCA vem no body da request — sempre do token JWT
const { institutionId, memberId, role } = req.user; // injetado pelo middleware auth

// ❌ NUNCA fazer isso:
const { institutionId } = req.body;
```

### 4.6 Convenção de Idioma — Código em Inglês, Schema em Português

**Regra:** todo o código é escrito em **inglês** — nomes de arquivos, classes, funções,
métodos, variáveis, parâmetros, tipos, interfaces, **entidades de domínio e suas
propriedades**, chaves do payload do JWT, enums TS, constantes e env vars. A **única
exceção** é o `schema.prisma`.

```typescript
// ✅ CORRETO — domínio em inglês
class Account { readonly displayName: string | null; /* ... */ }
class Member  { readonly institutionId: string; readonly role: PerfilUsuario; /* ... */ }
findByAccountId(accountId: string): Promise<Member | null>;
linkAccount(memberId: string, accountId: string): Promise<Member>;
```

**O que PERMANECE em português:**
- O arquivo `schema.prisma` (models, campos, enums e seus valores: `Conta`, `Membro`,
  `instituicaoId`, `ADMIN_GERAL`, `RASCUNHO`...).
- **Os nomes gerados pelo Prisma** acessados na fronteira do repositório: o tipo da row
  (`import type { Conta as ContaRow }`), o acesso ao client (`prisma.membro`, `prisma.conta`)
  e as colunas em literais (`where: { contaId }`, `data: { nome, perfil }`, `row.instituicaoId`).
  Isso é inevitável — é a API que o Prisma gera a partir do schema.
- O **tipo** e os **valores** do enum `PerfilUsuario` (`'MEMBRO'`, `'ADMIN_GERAL'`), por
  serem gerados pelo Prisma.

**A tradução PT↔EN acontece SÓ no repositório** (`infra/database/repositories`), nos
métodos `toEntity` (coluna PT → propriedade EN) e `save`/`update` (propriedade EN → coluna PT):

```typescript
// PrismaMemberRepository
private static toEntity(row: MembroRow): Member {
  return Member.restore({
    accountId:     row.contaId,        // contaId       → accountId
    institutionId: row.instituicaoId,  // instituicaoId → institutionId
    name:          row.nome,           // nome          → name
    role:          row.perfil,         // perfil        → role
    active:        row.ativo,          // ativo         → active
    createdAt:     row.criadoEm,       // criadoEm      → createdAt
    /* ... */
  });
}
```

**Não são identificadores — seguem outra regra:**
- **Comentários** permanecem em **português**.
- **Mensagens** (`AppError`, respostas da API ao usuário) permanecem em **português**.

---

## 5. Autenticação e RBAC

**Único método de login: Google OAuth 2.0.** Não existe cadastro por e-mail/senha.

```typescript
// Middleware auth: valida JWT → injeta req.user = { memberId, institutionId, role }
// Middleware rbac: verifica se req.user.role está na lista permitida

// Exemplos de uso nas rotas:
router.get('/membros',   auth, rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO'), asyncHandler(...));
router.post('/escalas',  auth, rbac('ADMIN_MINISTERIO'),                 asyncHandler(...));
router.get('/minhas-escalas', auth,                                      asyncHandler(...));

// Google OAuth flow:
// GET /auth/google          → redireciona para consent screen
// GET /auth/google/callback → troca code por tokens → cria/vincula Account + Member → JWT
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

## 10. Disciplina de Commits — Incrementais e Atômicos

O trabalho deve ser commitado em incrementos pequenos e lógicos, à medida que cada
parte fica pronta e testada — nunca num único commit grande no fim da tarefa.

### Princípios
- **Um commit = uma unidade lógica.** Cada entidade, repositório, use case + endpoint
  ou middleware vira seu próprio commit. Não misture mudanças sem relação no mesmo commit.
- **Cada commit deixa o projeto funcional.** O código deve compilar e rodar após cada
  commit — nunca commitar um estado que quebra o build.
- **Commitar progressivamente.** Assim que uma peça estiver pronta e validada, commitar
  antes de começar a próxima, em vez de acumular tudo.
- **Mensagem no padrão Conventional Commits**, descrevendo apenas o que aquele commit entrega.
- **Corpo em bullets.** Quando o commit tem corpo, descrever o que ele entrega em lista
  de bullets (`- item`), nunca em parágrafos corridos. O subject vai no imperativo; cada
  bullet cobre uma mudança relevante do commit.

### Ordem de prioridade dos commits
Ao concluir uma tarefa que toca várias camadas, separar com `git add` seletivo e
commitar nesta ordem:
1. **Schema e migrations primeiro** — mudanças em `schema.prisma` + a migration gerada.
2. **Documentação em seguida** — CLAUDE.md, TASKS.md, README, comentários relevantes.
3. **Código por último**, na ordem interna: entidade → repositório → use case → controller → rota.

### Sincronização com a main
- Antes de iniciar uma tarefa e antes de abrir o PR: `git fetch origin && git rebase origin/main`
- Resolver conflitos, rodar build e testes, e só então seguir.
- Se a branch já foi enviada, usar `git push --force-with-lease` (nunca `--force` puro).
- Alternativa mais segura enquanto pega o jeito: `git merge origin/main` no lugar do rebase.

### Exemplo — uma feature quebrada em commits
Em vez de um único `feat(auth): autenticação com Google`, preferir:

```
feat(auth): adiciona entidades Conta e Membro com factory create()
feat(auth): implementa repositórios de Conta e Membro
feat(auth): configura estratégia Google OAuth e rotas de login
feat(auth): adiciona serviço de geração e verificação de JWT
feat(auth): implementa middlewares auth, rbac e errorHandler
chore(auth): atualiza seed com admin geral para teste de login
```

Quando um commit precisa de corpo, o formato é subject + bullets:

```
feat(ministerios): implementa use cases do CRUD de ministérios
- Create e Update com 409 para nome duplicado na instituição.
- Get, Update e Delete validam o tenant e respondem 404 para outra instituição.
- Delete com cascata estrutural e 409 para escalas e funções em uso.
```

---

## 11. O que NUNCA Fazer

- Nunca receber `instituicaoId` no body — sempre do JWT (`req.user`)
- Nunca implementar login por e-mail/senha — autenticação é exclusivamente via Google OAuth
- Nunca usar formato de resposta diferente de `{ success, data, message }`
- Nunca usar construtor público em entidades de domínio
- Nunca omitir `asyncHandler` em rotas — exceções não tratadas derrubam o servidor
- Nunca fazer lógica de negócio no controller — pertence ao use case
- Nunca importar o PrismaClient diretamente no use case — sempre via repositório injetado
