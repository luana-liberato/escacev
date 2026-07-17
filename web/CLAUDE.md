# CLAUDE.md — Escacev Web (Frontend)

> Complementa o `.claude/CLAUDE.md` da raiz — **não o substitui**.
> Stack, regras de negócio (RN01–RN08), perfis e a convenção de idioma estão lá.
> Este arquivo cobre apenas o que é específico do frontend.

---

## 1. Estrutura de Pastas

```
web/src/
├── components/     # Componentes de UI reutilizáveis (sem regra de negócio)
├── pages/          # Uma pasta por tela; a tela compõe componentes e chama hooks
├── hooks/          # Estado e efeitos reutilizáveis (ex: useAuth)
├── services/       # Camada de contrato com a API — ÚNICO lugar que fala HTTP
│   ├── http.ts        # Cliente axios: JWT, unwrap do envelope, ApiError
│   ├── types.ts       # Tipos do domínio, espelhando o que a API serializa
│   └── <recurso>.ts   # Um módulo por recurso (ministries, members, schedules...)
└── main.tsx
```

As pastas nascem quando têm conteúdo — não criamos diretório vazio à espera de uso.

### Imports — alias `@/`

`@/` aponta para `src/` (configurado no `tsconfig.json` **e** no `vite.config.ts` — o
TS sozinho não ensina o bundler a resolver).

- **Cruzou de pasta → `@/`**: `import { http } from '@/services/http'`
- **Irmão na mesma pasta → relativo**: `import type { Ministry } from './types'`

Motivo: o alias existe para matar o `../../../` de tela aninhada; entre irmãos o
relativo é mais curto e já diz que a peça é local. (O `api/` usa relativo em tudo —
a divergência é deliberada: o front aninha mais.)

---

## 2. Camada de Serviços — Regra de Ouro

**Nenhum componente, página ou hook chama `axios`/`fetch` diretamente.** Toda ida à
API passa por um módulo de `services/`. Motivo: o envelope, o token, o mapeamento de
erro e os nomes em português das rotas ficam resolvidos num lugar só — a tela consome
dados já tipados e não redescobre o contrato.

```typescript
// ✅ CORRETO — a tela consome o serviço; recebe o dado, não o envelope
const ministries = await listMinistries();

// ❌ ERRADO — a tela nunca fala HTTP nem conhece o shape { success, data, message }
const res = await axios.get('/ministerios');
const ministries = res.data.data;
```

### O envelope não vaza
A API sempre responde `{ success, data, message }` (Seção 4.4 da raiz). O `http.ts`
desembrulha: em sucesso devolve `data` puro; em falha lança `ApiError` com `status` e
a `message` **em português, já pronta para exibir** — a API é a dona do texto de erro,
o front não reescreve mensagem de erro.

### Datas viajam como string ISO
A API serializa `Date` para string ISO no JSON. Os tipos de `types.ts` refletem o que
**chega no wire** (`string`), não a entidade do back. Converter para `Date` é
responsabilidade de quem formata, na borda da UI.

---

## 3. Autenticação

- Login **só** com Google (Seção 5 da raiz). Não existe formulário de e-mail/senha.
- Fluxo: o front manda o browser para `GET /auth/google` na API (navegação real, não
  XHR) → a API redireciona para o Google → callback → a API redireciona para a
  `FRONTEND_URL` (hoje `/auth/callback`) com o resultado na query.
- **O `window.location.href` do login destrói o app**: o navegador sai, e o que volta é
  um carregamento do zero. Nada sobrevive além do que está no endereço. Por isso o
  resultado viaja na query, e por isso a `LoginPage` não faz request nenhuma — ela só
  empurra o navegador. É a exceção; toda outra tela fala com a API via `services/`.
- **Sucesso → `?token=<jwt>`**: o callback guarda e manda para `/`.
- **Falha → `?error=<chave>`** (`auth_failed` | `no_email` | `not_authorized` |
  `api_error`): o callback **repassa** para `/login?error=`, que exibe o banner. A API
  conhece um endereço só (a `FRONTEND_URL`), então é o callback que roteia — e o erro
  de autenticação tem um lugar único para ser exibido.
- A API manda a **chave**, não a frase: o front decide o texto (`pages/loginErrors.ts`).
  Evita expor mensagem na barra de endereço e impede forjar um aviso falso num link.
  Chave desconhecida não vira banner.
- Se a `FRONTEND_URL` estiver vazia, a API **não redireciona**: devolve token e erros em
  JSON e o front nunca é acionado. É o modo "API sem front" do `.env.example`.
- **Logout é local:** o JWT é stateless e não há endpoint de logout — descartar o
  token é tudo. Não invente `POST /logout`.
- O `institutionId` vive **dentro** do JWT. O front nunca o envia em body nem em query.

---

## 4. Perfis e Proteção de Rotas

O `role` do JWT (`ADMIN_GERAL` | `ADMIN_MINISTERIO` | `MEMBRO`) é o filtro **grosso**
da navegação — decide o que aparece no menu e quais rotas o usuário abre.

**Ele não é a permissão real.** Um `ADMIN_MINISTERIO` só age nos ministérios onde tem
`isAdmin`, e essa checagem fina mora no back (`MinistryAccessPolicy`). O front **não
reimplementa** essa regra: chama a API e trata o `403` que vier. Esconder um botão é
conveniência de UX, nunca a garantia.

---

## 5. Conflito e Indisponibilidade — Alerta, não Erro

Ao alocar (`POST /escalas/:id/alocacoes`) ou editar (`PATCH /alocacoes/:id`), a API
responde **sucesso** (201/200) mesmo quando nada foi criado. Conflito (RN01/RN03) e
indisponibilidade (RN05) **não são erro HTTP** — são um estado "aguardando decisão do
admin", devolvido no corpo:

- `created` — alocações criadas.
- `failed` — inválidas, com `reason`; reenviar não adianta.
- `needsConfirmation` — passaram nas validações mas dispararam alerta (`conflicts`
  e/ou `unavailabilities`). O admin decide: reenviar o **mesmo** item com
  `confirm: true` cria mesmo assim.

Tratar `needsConfirmation` como erro quebra o núcleo do TCC — é justamente o fluxo de
sobrescrita ciente. `confirm` é uma flag **única**, que cobre os dois alertas.

---

## 6. Idioma

Vale a Seção 4.6 da raiz: **código em inglês** (arquivos, componentes, hooks,
variáveis, tipos, props), **comentários e textos de UI em português**. A tradução
PT↔EN das rotas acontece **só em `services/`** — o resto do front fala inglês.

```typescript
// services/ministries.ts — a rota é PT; o que sai daqui é EN
export async function listMinistries(): Promise<Ministry[]> {
  return http.get<Ministry[]>('/ministerios');
}
```

**Exceção:** valores de enum gerados pelo Prisma viajam no wire em português
(`ADMIN_GERAL`, `RASCUNHO`, `PUBLICADA`) — permanecem como estão.

---

## 7. O que NUNCA Fazer no Front

- Nunca chamar `axios`/`fetch` fora de `services/`
- Nunca deixar o shape `{ success, data, message }` escapar de `services/`
- Nunca reimplementar regra de negócio que o back já decide (escopo de admin, conflito)
- Nunca tratar `needsConfirmation` como erro
- Nunca guardar `institutionId` no front nem mandá-lo à API — ele vem do JWT
- Nunca implementar login por e-mail/senha
