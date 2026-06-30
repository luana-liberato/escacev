# Contribuindo com o Escacev

> Guia de convenções e fluxo de trabalho do projeto.
> Mantido como referência de processo e documentação do TCC.

O **Escacev** é um sistema web de gestão de escalas para grupos de voluntários,
desenvolvido como Trabalho de Conclusão de Curso. Este documento descreve como o
projeto é organizado e mantido.

---

## Como rodar o projeto

### Pré-requisitos
- Node.js 20 LTS
- Docker e Docker Compose
- Git

### Passos
```bash
# 1. Clonar o repositório
git clone <url-do-repo>
cd escacev

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com DATABASE_URL, credenciais do Google OAuth, etc.

# 3. Subir os serviços (postgres, api, web)
docker compose up -d

# 4. Rodar a migration e o seed
cd api
npx prisma migrate dev --name init
npx prisma db seed

# 5. Acessar
# API:      http://localhost:3001/health
# Frontend: http://localhost:5173
```

---

## Padrão de Commits — Conventional Commits

Toda mensagem de commit segue o formato:

```
<tipo>(<escopo>): <descrição curta no imperativo>
```

### Tipos
| Tipo | Quando usar |
|------|-------------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Mudança de código sem alterar comportamento |
| `test` | Adição ou ajuste de testes |
| `docs` | Documentação (README, comentários, este arquivo) |
| `chore` | Configuração, dependências, tarefas de manutenção |
| `perf` | Melhoria de performance |

### Escopos
O escopo mapeia o recurso ou a fase do projeto:
`auth`, `rbac`, `membros`, `ministerios`, `funcoes`, `eventos`, `escalas`,
`indisponibilidade`, `notificacoes`, `frontend`, `deploy`, `deps`

### Exemplos
```
feat(auth): login com Google via OAuth 2.0
feat(escalas): motor de conflito centrado no membro
fix(escalas): corrige sobreposição em eventos simultâneos
refactor(membros): extrai validação para a entidade
test(escalas): cobre cenários de incompatibilidade de função
docs: atualiza README com passos de deploy
chore(deps): adiciona passport-google-oauth20
```

---

## Disciplina de Commits — Incrementais e Atômicos

Além de seguir o formato Conventional Commits, o trabalho é commitado em incrementos
pequenos e lógicos, à medida que cada parte fica pronta e testada — nunca num único
commit grande ao final da tarefa. Isso mantém o histórico legível e serve como
registro do processo de construção do projeto.

### Princípios
- **Um commit = uma unidade lógica.** Cada entidade, repositório, use case + endpoint
  ou middleware vira seu próprio commit. Mudanças sem relação não compartilham o mesmo commit.
- **Cada commit deixa o projeto funcional.** O código compila e roda após cada commit —
  um estado que quebra o build não é commitado.
- **Commit progressivo.** Assim que uma peça é validada, ela é commitada antes do início
  da próxima, em vez de acumular tudo.
- **Mensagem descreve apenas o que aquele commit entrega**, no padrão Conventional Commits.
- **Ordem por dependência:** entidade → repositório → use case → controller → rota.

### Exemplo — uma feature quebrada em commits
Em vez de um único `feat(auth): autenticação com Google`, prefira:

```
feat(auth): adiciona entidades Conta e Membro com factory create()
feat(auth): implementa repositórios de Conta e Membro
feat(auth): configura estratégia Google OAuth e rotas de login
feat(auth): adiciona serviço de geração e verificação de JWT
feat(auth): implementa middlewares auth, rbac e errorHandler
chore(auth): atualiza seed com admin geral para teste de login
```

---

## Padrão de Branches

- **`main`** — sempre deployável. Reflete o estado estável do projeto.
- **`feat/<nome>`** — uma branch por recurso, criada a partir da `main`.

```bash
git checkout -b feat/google-oauth
# desenvolve, testa, commita
git push origin feat/google-oauth
# abre Pull Request para a main no GitHub
```

> O commit inicial (scaffold) vai direto na `main` — é a fundação do projeto.
> Branches de feature começam a partir da segunda tarefa.

---

## Fluxo de Trabalho

Para cada tarefa do `TASKS.md`:

1. **Planejar** — identificar a tarefa e o requisito (RF) correspondente
2. **Branch** — criar `feat/<nome>` a partir da `main` (a partir da Fase 2)
3. **Desenvolver** — seguir os padrões da arquitetura (ver abaixo)
4. **Testar** — validar no Postman/Insomnia (back) ou no browser (front); cenário positivo e negativo
5. **Commitar** — mensagem no padrão Conventional Commits, referenciando a issue (`closes #N`)
6. **Pull Request** — abrir PR para a `main`, revisar e fundir
7. **Marcar** — atualizar o checkbox no `TASKS.md`

---

## Arquitetura e Padrões de Código

A fonte da verdade dos padrões de código é o **`CLAUDE.md`** na raiz do projeto.
Em resumo:

- **Clean Architecture** em camadas: `domain` (entidades + use cases),
  `infra` (Prisma, HTTP, serviços), `shared` (erros, utils)
- **Entidades** com construtor privado + factory `create()`
- **Use cases** recebem dependências via injeção no construtor
- **Repositórios** abstraem o acesso ao Prisma
- Toda rota usa os middlewares `auth`, `rbac` e o wrapper `asyncHandler`
- Resposta da API sempre no shape `{ success, data, message }`
- `instituicaoId` sempre vem do JWT (`req.user`), nunca do body
- Autenticação **exclusivamente** via Google OAuth 2.0

---

## Marcos do Projeto (Tags)

| Tag | Marco |
|-----|-------|
| `sprint-0` | Scaffold inicial concluído |
| `v0.1.0` | Primeiro deploy em produção (testes com o cliente) |
| `v1.0.0` | Entrega final do TCC |

---

*Projeto Escacev · TCC · Cliente de validação: Igreja*
