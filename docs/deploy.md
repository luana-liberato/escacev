# Deploy em produção

Domínio único: o front em `https://escacev.com/` e a API atrás de
`https://escacev.com/api/`, no mesmo nginx. Front e API na **mesma origem** —
por isso não há CORS a configurar, e o bundle do front usa `/api` relativo, sem
o domínio embutido.

```
                    ┌─────────────────── VPS ───────────────────┐
  navegador ──443──▶│ nginx (web)                               │
                    │   /      → build estático do Vite         │
                    │   /api/  → proxy para api:3001 (sem /api) │
                    │                    │                      │
                    │              api ──┴──▶ postgres          │
                    └───────────────────────────────────────────┘
```

## Antes de começar

1. **DNS.** `escacev.com` e `www.escacev.com` com registro `A` apontando para o
   IP da VPS. Confira com `dig +short escacev.com` — sem isso o Let's Encrypt
   não valida o domínio e o passo do certificado falha.
2. **Docker na VPS.** `docker --version` e `docker compose version`.
3. **Google Console.** Em *Credenciais → URIs de redirecionamento autorizados*,
   adicione `https://escacev.com/api/auth/google/callback`. **O login falha se
   esse valor não bater exatamente com o `GOOGLE_CALLBACK_URL` do `.env`.**
4. **Conta SMTP real** (SendGrid ou similar). O Mailtrap é só de
   desenvolvimento: ele captura os e-mails e não entrega a ninguém. Convite é o
   único caminho de entrada de um membro, então sem SMTP você sobe o sistema e
   não consegue cadastrar ninguém além de si.

## Deploy

```bash
git clone https://github.com/luana-liberato/escacev.git
cd escacev

# 1. Variáveis. Veja o bloco "PRODUÇÃO" no fim do .env.example — ele lista
#    todas as obrigatórias e como gerar o JWT_SECRET.
cp .env.example .env
nano .env

# 2. Primeiro certificado + subir tudo (roda UMA vez; renovação é automática).
CERTBOT_EMAIL=voce@gmail.com sh scripts/init-letsencrypt.sh

# 3. Seed: cria a instituição e convida o primeiro ADMIN_GERAL.
#    Sem isto ninguém consegue entrar — o login exige um membro já convidado.
#    Use o e-mail do SEU Google em SEED_ADMIN_EMAIL no .env.
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma db seed
```

As migrations rodam sozinhas: o serviço `migrate` executa `prisma migrate
deploy` e encerra, e a API só sobe depois que ele sai com sucesso. Nunca há API
rodando contra um schema desatualizado.

## Conferir

```bash
curl https://escacev.com/api/health          # {"success":true,...,"status":"ok"}
curl -I https://escacev.com/                 # 200, o index.html
curl -I http://escacev.com/                  # 301 para https
curl -I https://escacev.com/agenda           # 200 (fallback de SPA, não 404)
```

Depois, no navegador: entrar com o Google, criar um ministério, um evento e uma
escala, e confirmar que o convite chega por e-mail de verdade.

## Operação

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f api

# Atualizar para a versão nova
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Backup do banco (o Postgres não expõe porta; o dump sai por dentro)
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U escacev escacev | gzip > backup-$(date +%F).sql.gz

# Restaurar
gunzip -c backup-2026-07-19.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U escacev escacev
```

O backup acima é manual. Agendar no cron da VPS é o item que falta para ele
valer de verdade — um backup que depende de alguém lembrar não é backup.

## Notas de segurança

- **O Postgres não é exposto à internet** — o serviço não publica portas, só
  existe na rede interna do compose. Para acessá-lo da sua máquina, use túnel
  SSH: `ssh -L 5432:localhost:5432 usuario@vps`.
- **A API também não é exposta** — só o nginx publica 80/443.
- **`JWT_SECRET` não tem valor padrão**: a API lança se ele faltar, em vez de
  assinar tokens com um segredo previsível.
- **Trocar o `JWT_SECRET` desloga todo mundo.** É o botão de emergência se algum
  token vazar.
- Pendência conhecida: um `ADMIN_GERAL` consegue rebaixar ou desativar a si
  mesmo pela API (`PUT /membros/:id`), e se ele for o único, a instituição fica
  sem administrador, sem recuperação pela aplicação. Enquanto a guarda não
  existe no back, **mantenha ao menos dois `ADMIN_GERAL` cadastrados** — com dois,
  um sempre pode restaurar o outro.
