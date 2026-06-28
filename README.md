# Escacev — Sistema de Gestão de Escalas

Monorepo com duas aplicações:

- **`api/`** — Node.js 20 + Express + TypeScript + Prisma + PostgreSQL
- **`web/`** — React 18 + Vite + Tailwind CSS

> Convenções, padrões de código e regras de negócio: ver [`CLAUDE.md`](./CLAUDE.md).

---

## Pré-requisitos

- Node.js 20+
- Docker + Docker Compose

## Configuração inicial

```bash
# 1. Variáveis de ambiente da API
cp .env.example api/.env

# 2. Dependências
cd api && npm install
cd ../web && npm install
```

## Subir o banco e aplicar o schema

```bash
# Na raiz — sobe postgres, api e web
docker compose up -d

# Primeira migration + seed (rodar dentro de api/)
cd api
npx prisma migrate dev --name init
npx prisma db seed
```

> O `docker compose` sobe o Postgres em `localhost:5432`. As migrations e o seed
> são executados a partir do host (`api/.env` aponta para `localhost`).

## Desenvolvimento (sem Docker para api/web)

```bash
# Terminal 1 — API em http://localhost:3001
cd api && npm run dev

# Terminal 2 — Web em http://localhost:5173
cd web && npm run dev
```

Healthcheck da API: `GET http://localhost:3001/health`

## Scripts úteis

```bash
# API
npm run dev        # hot reload (ts-node-dev)
npm run build      # compila para dist/
npm run lint       # ESLint
npx prisma studio  # explorar o banco

# Web
npm run dev        # Vite dev server
npm run build      # build de produção
npm run lint       # ESLint
```

## Serviços Docker

| Serviço          | Container          | Porta |
| ---------------- | ------------------ | ----- |
| PostgreSQL 16    | `escacev-postgres` | 5432  |
| API (Express)    | `escacev-api`      | 3001  |
| Web (Vite)       | `escacev-web`      | 5173  |
