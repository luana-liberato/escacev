# Deploy em produção

A VPS já hospeda outros projetos (`cantinhodajenny`, `juntosnameta`,
`realnaveia`) e tem um **nginx no host** que é o dono das portas 80 e 443. O
Escacev segue o mesmo padrão: os containers publicam **só em `127.0.0.1`**, e o
nginx do host termina o TLS e repassa para eles.

Domínio único: front em `https://escacev.com/` e API atrás de
`https://escacev.com/api/`. Mesma origem ⇒ **não há CORS a configurar**, e o
bundle usa `/api` relativo, sem o domínio embutido.

```
                         ┌──────────────── VPS ─────────────────┐
                         │ nginx DO HOST (80/443, TLS)          │
  navegador ────443─────▶│   escacev.com → 127.0.0.1:8083       │
                         │   (+ os outros 3 sites)              │
                         │            │                         │
                         │  ┌─────────▼──── compose do Escacev ─┐│
                         │  │ web  (nginx interno, :8083→80)    ││
                         │  │   /     → estáticos do Vite       ││
                         │  │   /api/ → api:3001 (sem /api)     ││
                         │  │ api ──▶ postgres                  ││
                         │  └───────────────────────────────────┘│
                         └──────────────────────────────────────┘
```

**Porta 8083** porque 8081 (juntosnameta), 8082 (cantinhodajenny) e 7080
(realnaveia) já estão ocupadas. A 3001 também está: é do `juntosnameta-backend`
— por isso a API do Escacev não publica porta nenhuma, só existe na rede interna
do compose.

## Antes de começar

1. **DNS.** `escacev.com` e `www.escacev.com` com registro `A` para o IP da VPS
   — ver a seção "DNS: Hostinger + Cloudflare" logo abaixo. Confira com
   `dig +short escacev.com`.
2. **Google Console.** Em *Credenciais → URIs de redirecionamento autorizados*,
   adicione `https://escacev.com/api/auth/google/callback`. **O login falha se
   não bater exatamente com o `GOOGLE_CALLBACK_URL` do `.env`.**
3. **Conta SMTP real** (SendGrid, Gmail, o e-mail do domínio na Hostinger…).
   Em desenvolvimento o projeto usa `SMTP_HOST="ethereal"`, a caixa de teste do
   Nodemailer, que **não entrega nada a ninguém** — serve só para conferir o
   HTML dos templates. Em produção isso não vale: convite é o único caminho de
   entrada de um membro, então sem SMTP de verdade você sobe o sistema e não
   consegue cadastrar ninguém além de si.

## DNS: Hostinger + Cloudflare

O domínio foi comprado na **Hostinger** e o DNS é gerido pelo **Cloudflare**. A
Hostinger continua sendo a dona do registro (é lá que se renova); o Cloudflare
só passa a responder pelas consultas de DNS.

> ⚠️ **A ordem importa.** Emita o certificado com o proxy do Cloudflare
> **desligado**. Com ele ligado desde o início, o `certbot --nginx` tende a
> falhar na validação, e o erro não diz que a causa é o Cloudflare.

### 1. Apontar o domínio para o Cloudflare

1. No Cloudflare: *Add a site* → `escacev.com` → plano Free. Ele varre os
   registros existentes na Hostinger e mostra dois nameservers
   (`algo.ns.cloudflare.com`).
2. Na Hostinger (hPanel): *Domínios → escacev.com → DNS / Nameservers* →
   **Alterar nameservers → Usar nameservers personalizados** e cole os dois.
3. Espere a propagação (minutos a algumas horas). O Cloudflare avisa por e-mail
   quando o domínio fica *Active*. Confira:
   `dig +short NS escacev.com` deve devolver os nameservers do Cloudflare.

### 2. Registros

Em *DNS → Records*, deixe só o necessário apontando para o IP da VPS:

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| A | `escacev.com` | IP da VPS | **DNS only** (nuvem cinza) — liga depois, no passo 4 |
| A | `www` | IP da VPS | **DNS only** — liga depois, no passo 4 |

Apague registros que a Hostinger tenha criado apontando para a hospedagem dela
(páginas de estacionamento), senão o domínio resolve para o lugar errado.

Confirme antes de seguir: `dig +short escacev.com` tem que devolver o IP da
VPS. Se devolver um IP do Cloudflare, o proxy ainda está ligado.

### 3. Emitir o certificado

Faça o deploy e rode o `certbot --nginx` (seção seguinte) **com o proxy ainda
desligado**. A validação HTTP-01 fala direto com a VPS, sem intermediário.

### 4. Ligar o proxy

**Só depois de `https://escacev.com` funcionar direto**, com o certificado já
emitido. Ligar antes disso quebra a emissão.

**4.1. Registros → Proxied.** Mude os dois registros A para a nuvem laranja.

**4.2. SSL/TLS → Overview → `Full (strict)`.** Isto não é detalhe:

- **Flexible** faz o Cloudflare falar HTTP com a VPS. Como o nginx redireciona
  HTTP para HTTPS, vira **laço infinito** (`ERR_TOO_MANY_REDIRECTS`). É o erro
  mais comum de Cloudflare e o diagnóstico engana, porque direto na VPS
  funciona.
- **Full** aceita certificado inválido na origem; **Full (strict)** valida. Com
  o Let's Encrypt instalado, use o strict — é o único que garante que o trecho
  Cloudflare→VPS também está cifrado e autenticado.

**4.3. Cache: bypass na API.** *Caching → Cache Rules* → nova regra:

- Expressão: `starts_with(http.request.uri.path, "/api/")`
- Ação: **Bypass cache**

Sem isso o Cloudflare pode cachear uma resposta da API e servir a mesma para
outro usuário — no Escacev, dados de escala de uma pessoa aparecendo para
outra. O padrão do Cloudflare já é conservador com JSON, mas aqui não vale
depender do padrão.

**4.4. IP real do visitante.** Com o proxy, quem conecta na VPS é o Cloudflare,
e o nginx passa a registrar o IP dele em todo acesso. Para restaurar o IP
verdadeiro:

```bash
sudo sh deploy/cloudflare-realip.sh
```

O script busca as faixas atuais do Cloudflare (elas mudam de tempos em tempos),
gera `/etc/nginx/conf.d/cloudflare-realip.conf` e recarrega o nginx. Rode de
novo se o Cloudflare anunciar faixas novas. É seguro para os outros 3 projetos:
`set_real_ip_from` só reescreve o IP quando a conexão vem de uma das faixas
listadas, e o tráfego deles não passa pelo Cloudflare.

### O proxy não esconde a VPS neste caso

O Cloudflare mascara o IP de origem de `escacev.com`, mas **os seus outros três
domínios apontam direto para a mesma VPS**. Quem consultar o DNS de qualquer um
deles descobre o IP e pode falar com o servidor sem passar pelo Cloudflare.

Isso não anula os outros ganhos (CDN, cache dos estáticos, TLS na borda,
filtragem), mas significa que **o proxy aqui não deve ser tratado como camada de
segurança**. Fechar esse flanco exigiria ou colocar os quatro domínios atrás do
Cloudflare, ou restringir no firewall o acesso às faixas dele — o que derrubaria
os três projetos não proxiados.

> Os nomes das telas do Cloudflare mudam de tempos em tempos; se algo não
> estiver onde este guia diz, procure pelo conceito (modo de criptografia SSL,
> regra de cache), não pelo caminho exato do menu.

### IP real do visitante (só se o proxy estiver ligado)

Com o proxy, todo acesso chega com o IP do Cloudflare, e os logs do nginx
passam a registrar só isso. Se precisar do IP real, adicione ao bloco `server`
do host as faixas do Cloudflare com `set_real_ip_from` e
`real_ip_header CF-Connecting-IP`. Não é necessário para o app funcionar — o
Escacev não usa IP em regra de negócio.

## Deploy

```bash
git clone https://github.com/luana-liberato/escacev.git
cd escacev

# 1. Variáveis. Veja o bloco "PRODUÇÃO" no fim do .env.example.
cp .env.example .env
nano .env

# 2. Subir o stack. Fica só em 127.0.0.1:8083 — ainda invisível de fora.
docker compose -f docker-compose.prod.yml up -d --build
curl -H 'Host: escacev.com' http://127.0.0.1:8083/api/health   # confira antes de seguir

# 3. Seed: cria a instituição e convida o primeiro ADMIN_GERAL.
#    Sem isto ninguém entra — o login exige um membro já convidado.
docker compose -f docker-compose.prod.yml run --rm migrate npx prisma db seed
```

As migrations rodam sozinhas: o serviço `migrate` executa `prisma migrate
deploy` e encerra, e a API só sobe depois que ele sai com sucesso. Nunca há API
rodando contra um schema desatualizado.

### Publicar no nginx do host

> ⚠️ **Este nginx serve os outros 3 projetos.** Uma configuração inválida faz o
> `reload` falhar e, se você reiniciar em vez de recarregar, **os 4 sites caem
> junto**. Sempre `nginx -t` antes, e `reload` (nunca `restart`).

```bash
sudo cp deploy/nginx-host.conf /etc/nginx/sites-available/escacev
sudo ln -s /etc/nginx/sites-available/escacev /etc/nginx/sites-enabled/escacev
sudo nginx -t && sudo systemctl reload nginx

# TLS: o certbot injeta os blocos 443 e o redirect no arquivo, como fez nos
# outros sites. Por isso o arquivo versionado é só HTTP.
sudo certbot --nginx -d escacev.com -d www.escacev.com
```

A renovação já está no cron/timer do certbot que serve os outros projetos — não
há nada a configurar aqui. Confirme com `sudo certbot renew --dry-run`.

## Conferir

```bash
curl https://escacev.com/api/health          # {"success":true,...,"status":"ok"}
curl -I https://escacev.com/                 # 200, o index.html
curl -I http://escacev.com/                  # 301 para https
curl -I https://escacev.com/agenda           # 200 (fallback de SPA, não 404)

# E que os outros projetos continuam de pé:
curl -I https://<dominio-do-outro-projeto>/
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

O backup acima é manual. Agendar no cron da VPS é o que falta para ele valer —
backup que depende de alguém lembrar não é backup.

## Notas de segurança

- **Nada do Escacev fica exposto à internet** além do que o nginx do host
  publica: o Postgres e a API não têm portas publicadas, e o `web` escuta só em
  `127.0.0.1`.
- Para acessar o banco da sua máquina, use túnel SSH:
  `ssh -L 5432:localhost:5432 usuario@vps` e então
  `docker compose -f docker-compose.prod.yml exec postgres psql -U escacev`.
- **`JWT_SECRET` não tem valor padrão**: a API lança se ele faltar, em vez de
  assinar tokens com um segredo previsível.
- **Trocar o `JWT_SECRET` desloga todo mundo.** É o botão de emergência se algum
  token vazar.
- Pendência conhecida: um `ADMIN_GERAL` consegue rebaixar ou desativar a si
  mesmo pela API (`PUT /membros/:id`), e se ele for o único, a instituição fica
  sem administrador, sem recuperação pela aplicação. Enquanto a guarda não
  existe no back, **mantenha ao menos dois `ADMIN_GERAL` cadastrados** — com
  dois, um sempre pode restaurar o outro.
