# TASKS.md — Escacev (Sistema de Gestão de Escalas)

> Lista mestre de tarefas do projeto. Organizada por **fase lógica de construção**,
> não por datas. Cada fase pressupõe a anterior concluída.
>
> **Escopo MVP:** instituição única (Igreja) pré-cadastrada via seed.
> Autenticação exclusiva via Google OAuth 2.0.
> Arquitetura multitenant preservada no schema para expansão futura (v2).

---

## Convenções

- `[ ]` tarefa pendente · `[x]` concluída
- 🔴 Essencial (bloqueia a entrega) · 🟡 Desejável (só se houver folga) · 🔵 Futuro (v2)
- Todo endpoint de back-end segue o padrão da Seção 4 do CLAUDE.md:
  **entidade** (construtor privado + `create()`) → **use case** (DI via construtor) →
  **repositório** (Prisma) → **controller** → **rota** (com `auth`, `rbac`, `asyncHandler`)
- Resposta sempre no shape `{ success, data, message }`
- `instituicaoId` sempre do JWT (`req.user`), nunca do body

---

## Fase 0 — Setup e Infraestrutura Base 🔴

- [x] Definir nome do projeto: **Escacev**
- [x] Criar repositório Git
- [x] Escrever CLAUDE.md (padrões, stack, regras de negócio)
- [x] Escrever schema.prisma completo
- [x] Gerar scaffold do monorepo (/api + /web)
- [x] Configurar Docker Compose (postgres + api + web)
- [x] Configurar TypeScript, ESLint, Prettier nos dois pacotes
- [x] Endpoint GET /health
- [x] .env.example, .gitignore, README
- [x] Primeira migration (init) + seed da instituição
- [x] Primeiro commit + tag sprint-0
- [ ] Provisionar VPS (Docker, nginx, domínio apontado)
- [x] Criar projeto no Google Cloud Console + tela de consentimento OAuth
- [x] Gerar Client ID e Client Secret do Google OAuth
- [ ] Configurar conta de e-mail transacional (Mailtrap para dev, SendGrid/SMTP para prod)

---

## Fase 1 — Banco de Dados e Camada de Persistência 🔴

- [ ] Revisar todos os models do schema.prisma e confirmar relações
- [ ] Confirmar índices: `Alocacao.membroId`, `Indisponibilidade(membroId, inicio, fim)`
- [x] Gerar o Prisma Client (`prisma generate`)
- [x] Implementar PrismaClient como singleton (`infra/database/prisma.ts`)
- [ ] Definir interface base de repositório (contrato genérico de persistência)
- [x] Implementar `AppError` com `statusCode` (`shared/errors/`)
- [x] Implementar `asyncHandler` (`shared/utils/`)
- [x] Implementar helper de resposta padronizada `{ success, data, message }`
- [x] Popular o seed com dados de teste mínimos (1 instituição, 1 admin geral, alguns ministérios e funções) para facilitar o desenvolvimento

---

## Fase 2 — Autenticação (Google OAuth) e Autorização (RBAC) 🔴

### Autenticação
- [x] Instalar Passport.js + passport-google-oauth20 (ou biblioteca equivalente)
- [x] Configurar estratégia Google OAuth com Client ID / Secret / callback URL
- [x] Implementar `GET /auth/google` (redireciona para a tela de consentimento)
- [x] Implementar `GET /auth/google/callback`:
  - [x] Trocar o `code` pelos tokens do Google
  - [x] Buscar `Conta` pelo `googleSub` (fallback: por e-mail)
  - [x] Criar `Conta` (googleSub + email + nomeExibido + fotoUrl) se não existir
  - [x] Vincular `Conta` ao `Membro` pelo e-mail, se houver convite pendente
  - [x] Emitir JWT com `{ memberId, institutionId, role }`
- [x] Definir geração e assinatura do JWT (secret + expiração via `.env`)
- [x] Implementar logout (no front: descartar o token) — `clearToken()` + `AuthProvider`
- [x] Tratar o caso de login com e-mail Google que não corresponde a nenhum membro convidado
- [x] Evitar `Conta` órfã no fluxo 403: a `Conta` só é criada após confirmar o convite; o login também vincula Contas órfãs pré-existentes ao convite pendente

### Autorização (RBAC)
- [x] Middleware `auth`: validar JWT → injetar `req.user`
- [x] Middleware `rbac(...roles)`: verificar se `req.user.role` está autorizado
- [x] Middleware global `errorHandler`: capturar `AppError` e formatar resposta
- [x] Definir os três perfis no enum: `ADMIN_GERAL`, `ADMIN_MINISTERIO`, `MEMBRO`
- [ ] Garantir que rotas de membro restrinjam acesso apenas aos próprios dados quando aplicável
- [x] **Perfil e status vêm do BANCO, não do JWT** — o middleware `auth` valida o token
      (que prova QUEM é a pessoa) e busca o `Membro` a cada request. O `role` do token é
      ignorado.
      **Motivo:** o perfil muda. Promover alguém e ler o papel do token fazia a promoção
      só valer no próximo login — até 7 dias (`JWT_EXPIRES_IN`) — porque o menu não
      aparecia e o `rbac` barrava. Com a derivação de perfil (marcar "admin" num
      ministério promove), o papel ficou ainda mais dinâmico.
      **E o caso grave:** DESATIVAR não desativava — o membro seguia usando o sistema com
      o token antigo por dias. Falha de segurança, não de UX. Agora recebe **401** (não
      403) para o front derrubar a sessão.
      Custo: uma consulta indexada por request. Trade-off aceito conscientemente — o JWT
      deixa de ser 100% stateless. (achado ao construir a tela de Membros)

---

## Fase 3 — Membros, Ministérios, Funções e Compatibilidade 🔴

> Ordem de execução: Membros → Ministérios → Associação → Permissão escopada → Funções → Matriz.
> Funções vem depois da associação e da permissão escopada, para já nascer com o RBAC
> escopado por ministério.

### Membros (RF03)
- [x] Entidade `Membro` + `create()` com validações
- [x] Use case: criar membro (convite por e-mail)
- [x] Use case: listar membros da instituição
- [x] Use case: atualizar membro (nome, perfil, ativo)
- [x] Use case: desativar/remover membro (soft delete via `ativo`)
- [x] Endpoints: `POST /membros`, `GET /membros`, `GET /membros/:id`, `PUT /membros/:id`, `DELETE /membros/:id`
- [x] Disparar e-mail de convite ao criar membro (integra com Fase 7)
- [x] **`GET /membros/me` — o membro busca os próprios dados** (PR #24). Member-scoped (só
      `auth`, sem `rbac`), resolvendo pelo `memberId` do JWT — o JWT não carrega o nome e
      `GET /membros/:id` exige admin, então um `MEMBRO` não lia o próprio cadastro.
      Reusa o `GetMemberUseCase` e a projeção pública. A rota é registrada **antes** de
      `/membros/:id` (senão o `:id` captura `"me"`), com teste travando a ordem.
      Destravou o rodapé da sidebar do layout base. (achado da fatia vertical de login)

### Ministérios (RF03)
> Escrita restrita ao `ADMIN_GERAL` neste bloco. A edição escopada pelo
> `ADMIN_MINISTERIO` entra no bloco "Permissão escopada" (depende do `isAdmin`).
- [x] Entidade `Ministry` + `create()`
- [x] Use cases: criar, listar, atualizar, remover (remoção em cascata — ver item abaixo)
- [x] Endpoints: `POST /ministerios`, `GET /ministerios`, `GET /ministerios/:id`, `PUT /ministerios/:id`, `DELETE /ministerios/:id`
- [x] RBAC: criar/editar/remover → `ADMIN_GERAL`; listar/ver → `ADMIN_GERAL`, `ADMIN_MINISTERIO`
- [x] **Remoção em cascata do ministério:** o `DELETE /ministerios/:id` apaga numa
      transação o que é **estrutural** do ministério — as funções (junto com as
      linhas de `CompatibilidadeFuncao` que as referenciam) e os vínculos
      `MembroMinisterio` (admins e membros deixam de estar ligados ao ministério
      apagado). **Motivo:** funções e vínculos não são histórico, são parte da
      estrutura do ministério; exigir a limpeza manual peça a peça tornaria a
      remoção impraticável na operação real.
      **O bloqueio (409) permanece apenas para o que é histórico:**
      escalas do ministério (registro de quem serviu) e funções já em uso em alguma
      `Alocacao` (alguém escalado nelas — apagar junto destruiria dado de escala).

### Associação Membro ↔ Ministério, com papel de admin (RF03)
> **Mudança de schema:** adicionar `isAdmin Boolean @default(false)` ao model
> `MembroMinisterio`. Migration primeiro, depois código (disciplina de commits).
- [x] Schema: adicionar `isAdmin Boolean @default(false)` em `MembroMinisterio` + migration
- [x] Use case: associar membro a ministério, recebendo `isAdmin` opcional (padrão `false`)
- [x] Use case: promover/rebaixar admin do ministério (alternar `isAdmin` numa associação existente)
- [x] Use case: remover membro de ministério
- [x] Use case: listar ministérios de um membro / membros de um ministério (indicando quem é admin)
- [x] Endpoints: `POST /ministerios/:id/membros` (body aceita `isAdmin`),
      `PATCH /ministerios/:id/membros/:membroId/admin` (promover/rebaixar),
      `DELETE /ministerios/:id/membros/:membroId`
- [x] Regra: existir a associação = participa (é escalável); `isAdmin = true` = também administra
- [x] Convite escopado por ministério (endpoint POST /ministerios/:id/membros/convite):
      recebe { name, email, isAdmin? } e faz criar-ou-associar — e-mail novo cria o Membro
      e associa; e-mail existente fora do ministério só associa; e-mail já no ministério → 409.
      Reutiliza a criação de membro do bloco Membros (não duplica validação).
      ADMIN_MINISTERIO nunca cria membro "solto"; ADMIN_GERAL convida no nível da instituição.

### Permissão escopada de edição de ministério (RF03)
> Fecha a pergunta "o ADMIN_MINISTERIO edita o próprio ministério". Depende do
> `isAdmin` do bloco anterior — é o "voltar e afinar" da Forma A.
- [x] Ajustar RBAC do `PUT /ministerios/:id`: permitir `ADMIN_GERAL` OU
      `ADMIN_MINISTERIO` com `isAdmin = true` naquele ministério
- [x] Criar guarda reutilizável "é admin deste ministério" (usada aqui, em funções, em associações e nas escalas na Fase 5)
- [x] Garantir que um admin não edita ministério em que não tem `isAdmin`

### Funções (RF03)
> Construído depois da associação para já nascer com o RBAC escopado (reusa a guarda "é admin deste ministério").
> **Atenção ao nome em inglês:** `role` já é o campo de perfil no JWT — não reusar "Role"
> para a função. Decidido: **`Position`** (mapeia o model `Funcao` do Prisma).
- [x] Entidade da função + `create()` (nome em inglês: `Position`)
- [x] Use cases: criar, listar, atualizar, remover função dentro de um ministério
- [x] Endpoints: `POST /ministerios/:id/funcoes`, `GET /ministerios/:id/funcoes`, `PUT /funcoes/:id`, `DELETE /funcoes/:id`
- [x] RBAC: gerenciar funções → `ADMIN_GERAL` OU admin escopado do ministério (`isAdmin = true`)
- [ ] Resolver código órfão: `GetPositionUseCase` existe mas nenhuma rota o usa.
      Decidir entre expor `GET /funcoes/:id` (provável necessidade do frontend) ou
      remover o use case. (achado O1 da auditoria)

### Matriz de Compatibilidade de Funções (RN01, RN02)
> Entidade em inglês `PositionCompatibility` (mapeia o model `CompatibilidadeFuncao`).
> Escrita E leitura restritas ao `ADMIN_GERAL` (matriz é escopo de instituição, sem
> MinistryAccessPolicy — um par pode ligar funções de ministérios diferentes).
> Verificado de ponta a ponta na API real (13/13 cenários: forma canônica, idempotência,
> tenant, RBAC).
- [x] Entidade `PositionCompatibility` com regra de armazenamento `funcaoAId < funcaoBId` (forma canônica)
- [x] Use case: marcar par de funções como compatível (`Set`, idempotente em duplicata)
- [x] Use case: remover compatibilidade (`Remove`, idempotente; volta a ser incompatível por padrão)
- [x] Use case: consultar compatibilidade entre duas funções (`Check`, dois ids → boolean, para injetar no motor de conflito da Fase 5)
- [x] Use case extra: listar os pares da instituição (`List`, insumo para a tela de matriz)
- [x] Endpoints: `POST /funcoes/compatibilidade`, `DELETE /funcoes/compatibilidade` (ids na query), `GET /funcoes/compatibilidade`
- [x] Garantir o default: ausência de registro = funções incompatíveis

---

## Fase 4 — Eventos e Calendário 🔴

> **Modelo de alocação direta:** o evento é da **instituição** e não tem "vagas"
> abstratas — quem indica pessoa + função é a escala de cada ministério (Fase 5).
> Qualquer admin (**`ADMIN_GERAL`** ou **`ADMIN_MINISTERIO`**) pode criar eventos.
> O planejamento de vagas em aberto virou item DESEJÁVEL (ver Fase 9).

### Eventos (RF04)
- [x] Entidade `Evento` + `create()` (validar `fim > inicio`)
- [x] Use cases: criar, listar (com filtro por período), atualizar, remover evento
- [x] Permitir criação por `ADMIN_GERAL` e `ADMIN_MINISTERIO`
- [x] Suportar eventos simultâneos no calendário
- [x] Endpoints: `POST /eventos`, `GET /eventos` (com query de período), `GET /eventos/:id`, `PUT /eventos/:id`, `DELETE /eventos/:id`

---

## Fase 5 — Escalas e Motor de Conflito (NÚCLEO) 🔴

> **Modelo de alocação direta:** cada ministério monta a **sua** escala para um
> evento, indicando **pessoa + função diretamente** — não há vaga abstrata. A escrita
> de escala/alocação segue a **Permissão Escopada** (`ADMIN_GERAL`, ou `ADMIN_MINISTERIO`
> com `isAdmin` no ministério da escala) — reusa a `MinistryAccessPolicy`.

### Escalas (RF05) — casca (sem alocações)
- [x] Entidade `Schedule` (model `Escala`) + `create()` (status inicial RASCUNHO)
- [x] Escala = de um ministério para um evento, com **rótulo/`nome` opcional**
      (`@@unique([ministerioId, eventoId, nome])`): um ministério pode ter **VÁRIAS**
      escalas por evento distinguidas pelo nome (ex: infantil com "Berçário", "Sala 1",
      "Sala 2"); `nome = ""` é a escala única padrão. Duplicata de nome é case-insensitive.
- [x] Use case: criar escala (ministério + evento + nome opcional); 409 na duplicata do trio
- [x] Use case: buscar escala com suas alocações (`GetSchedule` retorna `{ schedule, assignments }`, com membro e função resolvidos numa única consulta — sem N+1)
- [x] Use case: listar escalas (por evento, por ministério, ambos → todas as salas, ou todas da instituição)
- [x] Use case: remover escala (casca; delete simples hoje — cascata das alocações quando existirem)
- [x] RBAC das escritas: `ADMIN_GERAL` ou admin escopado do ministério da escala (reusa a `MinistryAccessPolicy`); leitura aberta a admins
- [x] Endpoints: `POST /escalas`, `GET /escalas` (filtros `?eventId`/`?ministryId`), `GET /escalas/:id`, `DELETE /escalas/:id`
- [x] Testes: entidade, use cases (unit) e endpoints (supertest) — inclui salas por evento e caixa diferente

### Alocações (RF05)
- [x] Entidade `Assignment` (model `Alocacao`) = **membro + função + escala, direto** (`positionId`, sem vaga) + `conflict` (sempre `false` aqui — RN03 é do motor de conflito)
- [x] Use case: alocar membro numa função da escala — em **lote** (`AddAssignmentsUseCase`): itens válidos são criados, inválidos são reportados com o motivo (`created`/`failed`), sem transação com rollback geral
- [x] Use case: editar alocação (`UpdateAssignmentUseCase`, unitária) — troca membro e/ou função; 409 se a edição colidir com uma alocação já existente na escala
- [x] Use case: remover alocação (`RemoveAssignmentUseCase`; 404 se inexistente — não idempotente, como os demais deletes)
- [x] Validar que o membro pertence ao ministério da escala
- [x] Validar que a função pertence ao ministério da escala
      (`AssignmentEligibility`, serviço compartilhado entre adicionar e editar — não duplica a regra)
- [x] RBAC das escritas: `ADMIN_GERAL` ou admin escopado do ministério da escala (reusa a `MinistryAccessPolicy`)
- [x] Endpoints: `POST /escalas/:id/alocacoes` (lote), `PATCH /alocacoes/:id` (edição unitária), `DELETE /alocacoes/:id`
- [x] Testes: entidade, `AssignmentEligibility`, use cases (unit) e rotas (supertest)

### Motor de Conflito (RN01, RN02, RN03, RN07) — coração do TCC
> **Preparação da Fase 3 já pronta:** a peça de compatibilidade
> (`CheckPositionCompatibilityUseCase`, assinatura `(positionAId, positionBId) → boolean`)
> já existe e foi desenhada para ser **injetada** aqui — o motor consome, não reimplementa.
> O schema também já suporta a varredura: `Alocacao.membroId` indexado e o caminho
> `Alocacao → Escala → Evento` (horário) + `Alocacao → Funcao` (função, direto).
>
> **Cenário-guia:** o admin do Ministério A monta a escala, mas o membro pode já estar
> escalado no Ministério B em horário sobreposto. Por isso a varredura é no **tenant
> inteiro** (todos os ministérios), não só no ministério do admin — e é também o motivo de
> a matriz de compatibilidade ser institucional (`ADMIN_GERAL`), já que um par pode ligar
> funções de ministérios diferentes.
- [x] Implementar serviço de detecção de conflito centrado no membro:
  - [x] Dado um membro, buscar **todas** as suas alocações (em todos os ministérios)
  - [x] Detectar sobreposição de horário: `novo.inicio < existente.fim AND novo.fim > existente.inicio`
  - [x] Para cada sobreposição, checar a compatibilidade via o `CheckPositionCompatibilityUseCase` (Fase 3, já pronto) — não reimplementar
  - [x] Marcar conflito apenas quando as funções são incompatíveis (RN02)
  - [x] Tratar **mesma função sobreposta** (mesmo `funcaoId`) como conflito — o `Check` devolve `false` para ids iguais (não existe linha canônica para par igual; ninguém em dois lugares ao mesmo tempo)
  - [x] Retornar detalhes claros: qual evento, qual escala, qual função conflita
- [x] Integrar o motor à criação (`AddAssignmentsUseCase`) e à edição (`UpdateAssignmentUseCase`) de alocações, com confirmação ciente (RN03)
- [x] Endpoint de consulta (read-only) dos conflitos de uma escala: `GET /escalas/:id/conflitos` (reavalia ao vivo, sem gravar)
- [x] **DECISÃO DE PRODUTO — visibilidade cross-ministério: resolvido por transparência total.** O
      `ConflictDetail` expõe os nomes legíveis (membro/função/ministério/evento) inclusive de
      ministérios que o admin **não** administra, sem filtragem por papel. (Reavaliar na UI se
      necessário — não é bloqueio técnico.)
- [x] Aplicar prioridade por publicação: escala publicada primeiro tem precedência (RN07)
      (o motor traz `publicadaEm` da escala no `MemberAssignmentContext` e o `ConflictDetail`
      expõe `existingHasPrecedence` — comparação por `publicadaEm`, a publicada antes prevalece;
      metadado para o admin, não altera a detecção)
- [x] Permitir que o admin confirme a alocação mesmo com conflito (RN03)
- [x] Registrar a sobrescrita: `alocacao.conflito = true`
> **Nota operacional (RN02):** matriz vazia = todo par sobreposto vira conflito; a matriz
> precisa ser populada pelo `ADMIN_GERAL` para o motor ser útil (é o default, não bug).
> Não é tarefa — descreve comportamento já implementado (`CheckPositionCompatibilityUseCase`).
- [x] Cobrir o motor de conflito com testes (detecção pura, integração no Add/Update, consulta 3b)

### Publicação de Escala (RN04)
- [x] Use case: publicar escala → `status = PUBLICADA` + preencher `publicadaEm`
      (`PublishScheduleUseCase`; escopo de ministério; republicar bloqueado com 409 para
      preservar `publicadaEm`, base do RN07)
- [x] Garantir que escala RASCUNHO seja invisível ao membro
      (filtro `status = PUBLICADA` na origem, `findByMemberPublishedInRange`)
- [x] Use case: listar "minhas escalas" (apenas as PUBLICADAS onde o membro está alocado)
      (`GetMyScheduleUseCase`, member-scoped via JWT)
- [x] **Visão do membro agregada por período (semana/dia/mês):** puxar todas as alocações
      do membro no intervalo, de **todos os ministérios** (só PUBLICADAS, RN04). A **visão
      mensal é a principal** forma de consumo do membro. (Período `?from&?to`; mês corrente por padrão.)
- [x] Endpoint: `PATCH /escalas/:id/publicar`
- [x] Endpoint: `GET /minhas-escalas`
- [x] Disparar notificação ao publicar (integra com Fase 7)

---

## Fase 6 — Indisponibilidade de Membros 🔴

### Indisponibilidade (RF06, RN05)
> **Grupo A (CRUD member-scoped) — CONCLUÍDO** na branch `feat/indisponibilidade` (a
> partir da `main`): entidade `Unavailability` (mapeia `Indisponibilidade`, nome em
> inglês pela Seção 4.6), repositório, use cases do membro e endpoints, com testes
> (entidade + use cases + rotas). Sem mudança de schema — a tabela já existe desde a
> migration `init`. O repositório já expõe `findByMemberOverlapping` como gancho pronto
> para o Grupo B consumir.
>
> **Grupo B (integração com o motor de conflito) — PENDENTE:** depende do merge do
> motor (branch `feat/motor-conflito`). Será feito depois, rebaseando a branch sobre a
> `main` atualizada e plugando a indisponibilidade como alerta paralelo ao conflito.
- [x] Entidade `Indisponibilidade` + `create()` (validar período)
- [x] Use case: membro registra período de indisponibilidade
- [x] Use case: membro lista/remove suas indisponibilidades
- [x] Use case: admin consulta indisponibilidades ao montar escala
      (`ListMemberUnavailabilitiesUseCase` + `GET /membros/:id/indisponibilidades`, rbac admin + tenant via membro)
- [x] Integrar com o motor de conflito: **alertar** o admin ao tentar escalar membro indisponível no período (RN05)
      (Add/Update de alocação checam `findByMemberOverlapping` em paralelo ao conflito; alerta em `needsConfirmation`)
- [x] Permitir que o admin ignore o alerta e escale mesmo assim
      (flag única `confirm` cobre conflito + indisponibilidade; a indisponibilidade é só alerta, não marca a alocação)
- [x] Endpoints: `POST /indisponibilidades`, `GET /indisponibilidades/minhas`, `DELETE /indisponibilidades/:id`
- [x] Disparar alerta ao admin quando membro registra indisponibilidade que afeta escala já existente (integra com Fase 7)

### Sobrecarga (RN06) — pode ser tratada aqui ou no dashboard
- [ ] Definir limite configurável de escalas simultâneas por membro no período
- [ ] Alertar (não bloquear) quando o membro ultrapassar o limite

---

## Fase 7 — Notificações por E-mail 🔴

### Infraestrutura de e-mail (RF08)
- [x] Configurar serviço de envio (Nodemailer + SMTP)
- [ ] Criar templates de e-mail — convite/escalado/indisponibilidade-conflito FEITOS (`emailTemplates.ts`); lembrete = S4 (🟡, não implementado nesta rodada)
- [x] Entidade `Notificacao` (registro interno) + use case para criar/listar/marcar como lida

### Gatilhos de notificação (RF08, RN08)
- [x] E-mail de **convite** ao cadastrar um novo membro
- [x] E-mail ao membro quando é **escalado** em um evento (na publicação)
- [ ] 🟡 **Lembrete** antes do evento (X horas antes — configurável) — S4, não implementado nesta rodada
- [x] Alerta ao admin quando membro registra **indisponibilidade** que conflita com escala existente
- [x] Endpoints internos: `GET /notificacoes`, `PATCH /notificacoes/:id/lida`
- [ ] 🟡 Decidir mecanismo do lembrete (cron job / agendador na API) — S4

---

## Fase 8 — Frontend 🔴

> **Estratégia: fatia vertical, não camada horizontal.** Constrói-se uma jornada
> inteira atravessando todas as camadas, em vez de uma camada completa por vez —
> assim o caminho é validado cedo, e não na integração final. As pastas
> (`components/`, `pages/`, `hooks/`) nascem com conteúdo; não se cria diretório
> vazio à espera de uso.
>
> **Camada de contrato (`services/`) — CONCLUÍDA** na branch `feat/front-contrato`:
> `http.ts` (axios + JWT + unwrap do envelope + `ApiError`), `types.ts` (espelham o
> que a API **serializa**, não as entidades), `authToken.ts` e `ministries.ts`.
> Ver o `web/CLAUDE.md` para os padrões do front.
>
> **Fatia vertical 1 (login → callback → sessão → rota protegida) — CONCLUÍDA** e
> verificada de ponta a ponta com o admin do seed.

### Base
- [x] Configurar roteamento (React Router)
- [x] Configurar cliente HTTP (axios) com interceptor que injeta o JWT (`services/http.ts`)
- [x] Configurar contexto/estado de autenticação (usuário logado, perfil)
      (`hooks/authContext.ts` + `hooks/useAuth.ts` + `components/AuthProvider.tsx`)
- [x] Implementar proteção de rotas **por perfil** — o `ProtectedRoute` exige sessão e
      checa o `roles` do `config/navigation.ts`; rota que o perfil não alcança redireciona
      para a primeira tela dele (não para uma constante, o que viraria loop). É
      conveniência de UX: a permissão real — inclusive a escopada por ministério
      (`isAdmin`) — é decidida pela API, e o front trata o 403.
- [x] Layout base: sidebar de navegação + header com usuário logado — casca padrão de
      todas as telas internas (`components/AppLayout.tsx`), conforme
      `docs/design/layout_sidebar/`. Sidebar fixa ≥861px; drawer com hambúrguer e overlay
      abaixo. Rodapé com nome/iniciais/papel via `GET /membros/me`. Menu, rotas e
      cabeçalhos saem de `config/navigation.ts`.
- [ ] 🔴 **Abrir `GET /escalas` ao MEMBRO** (decisão da cliente): ele precisa ver as
      escalas do próprio ministério, não só onde está alocado. Hoje é
      `rbac('ADMIN_GERAL', 'ADMIN_MINISTERIO')` e ele leva 403 — por isso "Escalas" está
      fora do menu dele. Exige filtro por vínculo (`MembroMinisterio`) + `status =
      PUBLICADA` (RN04: rascunho é invisível ao membro). Note que é diferente da **Agenda**
      (`GET /minhas-escalas`, "onde EU estou escalado"), que já existe e já é aberta.
      `GET /eventos` também é admin-only e cai na mesma pergunta.
- [ ] Tela de tratamento de erros e loading states reutilizáveis — **adiado de propósito
      até a primeira tela de conteúdo (Ministérios)**. Extrair antes seria adivinhar a
      forma: spinner de página ou skeleton no lugar do conteúdo? Erro como banner, card ou
      estado vazio? 403 x 404 x "servidor fora" se parecem? Já existem três estados de
      carregamento no código (callback, skeleton do nome na sidebar, e o antigo indicador
      do login) e nenhum se pareceu o bastante para virar componente. Quando a segunda ou
      terceira tela repetir o padrão, ele se extrai sozinho — já validado.
      (Mesma lição do `types.ts`: os 7 tipos sem consumidor seguem não verificados, e
      dos 4 verificados, 4 estavam errados.)

### Autenticação
- [x] Tela de login com botão "Entrar com Google" (com indicador de conexão da API)
- [x] Tela de callback (recebe o token, redireciona para o painel)
- [x] Fluxo de logout

### Telas de Gestão (Admin)
- [ ] Listagem e CRUD de **ministérios**
- [ ] Listagem e CRUD de **funções** por ministério
- [x] Listagem e CRUD de **membros** (com envio de convite) — tela completa (PR #27,
      `web/src/pages/members/`): lista com filtro/busca, convite (dois fluxos — admin geral
      na instituição, admin de grupo escopado no ministério), edição, "Promover a admin
      geral" com confirmação, "Promover" do admin de grupo em dois passos, toast global e
      "Meu perfil". Perfil `ADMIN_MINISTERIO` **derivado** de administrar algum ministério
      (não é campo). Ao construir, corrigidos dois bugs de auth (ver Fase 2).
- [ ] 🔴 **Guarda de auto-alteração de perfil na API** — hoje o admin geral **se
      rebaixar** é bloqueado só pela TELA (`MemberModal` esconde o botão para si mesmo).
      A API não impede: `PUT /membros/:id` aceita `role` para qualquer id, inclusive o
      próprio. Se o admin geral for o único e se rebaixar, **a instituição fica sem ninguém
      que a administre** — e ninguém promove de volta, porque promover exige ser admin
      geral. Lockout permanente. A regra tem que ir para o `UpdateMemberUseCase`,
      comparando o alvo com o `memberId` do JWT. Mesmo princípio da sessão toda: esconder
      o botão é conveniência; quem protege é o back. (achado ao construir a tela)
- [ ] **Botão "Rebaixar para Membro"** no modal de edição (handoff v3, linha 82) — o
      "desfazer" do poder administrativo num clique: zera `isGeneralAdmin` e **todos** os
      `adminMinistryIds` de uma vez, preservando a participação nos ministérios. Aparece
      quando a pessoa é admin geral ou administra algum ministério, e não é sobre si mesmo.
      **A regra já existe na API** (o `UpdateMemberUseCase` limpa o `isAdmin` ao receber
      `role: MEMBRO`, testado) — falta só o botão no front. O "Promover a admin geral" já
      entrou no PR #27; este é o par que ficou.
- [ ] **Derivação do `SetMembershipAdminUseCase` — testes passam mas não provados por
      mutação.** O `strictNullChecks` resistiu às tentativas de mutação, então lá há testes
      verdes sem a prova de que pegam o bug (nas outras duas portas a mutação funcionou).
      Revisar se vale reforçar. (achado no PR #27)
- [ ] Tela de associação de membros a ministérios — **parcialmente coberta pela tela de
      Membros:** o modal de edição já associa/desassocia via chips (`PUT
      /membros/:id/ministerios`). Uma tela dedicada só se a associação em massa pedir.
- [ ] Tela da **matriz de compatibilidade** de funções
- [ ] Listagem e CRUD de **eventos** (calendário da instituição)
- [ ] **Calendário** de eventos (visualização mensal/semanal ou lista)

### Telas de Escala
- [ ] Tela de **geração de escala**: selecionar evento, ministério, alocar membros (pessoa + função)
- [ ] Indicadores visuais de **conflito** e **indisponibilidade** na alocação
- [ ] Confirmação de alocação com conflito (sobrescrita ciente)
- [ ] Botão de **publicar** escala
- [ ] Tela de visualização de escala publicada

### Telas do Membro
- [ ] "Onde estou escalado" (lista de escalas publicadas do membro)
- [ ] Registro e listagem das próprias **indisponibilidades**
- [ ] Central de notificações (in-app)

---

## Fase 9 — Funcionalidades Desejáveis 🟡

### Remoção física de membro (🟡)
> **Hoje o `DELETE /membros/:id` é soft delete** (`ativo = false`) e assim permanece — é o
> comportamento certo para o caso real ("a pessoa saiu da igreja"): ela some das listas e
> deixa de ser escalável, e as escalas passadas continuam íntegras.
>
> **O banco também impede o hard delete hoje:** seis FKs apontam para `Membro`
> (`MembroMinisterio`, `Alocacao`, `Indisponibilidade`, `Troca.proponenteId`,
> `Troca.alvoId`, `Notificacao`) e **nenhuma declara `onDelete`** — o default do Prisma é
> `Restrict`, então apagar um membro escalado falha com erro de FK. A única exceção no
> schema é `Membro.conta` (`onDelete: SetNull`).
>
> **Por que não apagar:** a `Alocacao` é o registro de quem serviu naquele culto. Apagar o
> membro apaga a escala de um evento que já aconteceu — a escala de dezembro passaria a ter
> um vocalista a menos, retroativamente. Não é o membro sumindo: é a história da igreja
> sendo reescrita.
- [ ] 🟡 **Delete condicional** — apagar de verdade só quando não há histórico (nenhuma
      alocação/troca/indisponibilidade), e **409** quando há. Resolve o caso legítimo:
      cadastro errado ou duplicado, que nunca foi escalado. Mesmo padrão do
      `DELETE /ministerios/:id`, que já bloqueia com 409 pelo que é histórico.
- [ ] 🟡 **Anonimização (LGPD)** — se um dia alguém exigir a remoção dos dados pessoais, a
      saída não é apagar a linha: é anonimizar (nome vira "Membro removido", e-mail
      limpo, `Conta` desvinculada). A `Alocacao` continua existindo, apontando para um
      registro sem dado pessoal — a escala se preserva, a pessoa some. O
      `onDelete: SetNull` da `Conta` já ajuda: apagá-la devolve o membro a convite
      pendente sem quebrar nada.

### Planejamento de vagas em aberto (🟡 — o antigo `VagaEvento`, agora opcional)
> No modelo essencial a alocação é direta (pessoa + função). Planejar vaga em aberto
> — declarar a necessidade antes de ter a pessoa — passa a ser um recurso desejável.
- [ ] 🟡 Permitir que uma escala **declare necessidade por função** antes de ter as pessoas
      (ex: "faltam 2 vocais"), sobre o modelo de alocação direta.
- [ ] 🟡 Preencher a vaga em aberto alocando a pessoa (converte a necessidade em `Alocacao`).

### Pedido de ajuda cross-ministério (🟡)
- [ ] 🟡 Admin de um ministério X solicita a alocação de alguém de um ministério Y para um
      evento (ex: culto infantil pedindo uma pessoa da recepção).
- [ ] 🟡 Fluxo de solicitação → aceite (pela pessoa e/ou pelo admin do ministério Y) → alocação.

### Trocas e Substituições (RF09, RN08)
- [ ] Entidade `Troca` (proponente, alvo, alocação de origem, tipo, status)
- [ ] Use case: solicitar **troca direta** entre dois membros
- [ ] Use case: solicitar **cobertura** (aberta a candidatos)
- [ ] Use case: aceitar/rejeitar troca
- [ ] Use case: admin confirma a troca
- [ ] Validar: troca só entre membros do mesmo ministério (RN08)
- [ ] Notificar todos os envolvidos em cada etapa (RN08)
- [ ] Endpoints de troca + telas no frontend

### Dashboard e Relatórios (RF07)
- [ ] Painel com quantidade de escalas por membro no período
- [ ] Indicador de **sobrecarga** (RN06)
- [ ] Métricas de participação por ministério
- [ ] Visualização gráfica (distribuição de escalas, membros mais/menos escalados)

---

## Fase 10 — Testes e Qualidade 🔴

- [ ] 🔴 **A main está VERMELHA: 2 testes de `compatibility.routes.test.ts` falham na suíte
      completa.** Não é regressão — reproduz na `main` limpa, 3/3 rodadas. Isolado o arquivo
      passa; `compatibility` + `assignment` juntos reproduzem. O banco está limpo (zero linhas
      órfãs), então **não é estado residual: é corrida entre workers do Jest no mesmo banco**.
      **Causa:** o teste assume ser o dono único da tabela — usa
      `prisma.compatibilidadeFuncao.findFirst()` (linha ~81) e `.count()` (linhas ~88 e ~147)
      **sem `where`**. Quando o `assignment.routes.test.ts` roda em paralelo e cria os próprios
      pares para o motor de conflito, o `count()` enxerga as linhas dele e o `findFirst()` pode
      devolver a linha errada. Os demais testes de rota escopam tudo por fixtures `test-`.
      **Correção:** escopar o `findFirst`/`count` pelas funções do próprio teste. Sugerida em
      branch curta e separada (`fix/testes-compatibilidade-isolamento`), antes de novos merges —
      o CONTRIBUTING diz que a `main` é sempre deployável. (achado ao verificar a
      `fix/auth-callback-redirect-erro`)
- [ ] Testes unitários do **motor de conflito** (cenários: sem conflito, sobreposição compatível, sobreposição incompatível, prioridade por publicação)
- [x] Testes unitários das entidades (validações de `create()`) — 7/7 entidades com suíte dedicada (Parte A)
- [ ] Testes de integração dos principais fluxos (criar escala → alocar → publicar) — depende da Fase 5
- [ ] Testar RBAC: cada perfil acessa apenas o que pode — Fases 2–4 cobertas nos testes de rota; endpoints da Fase 5 pendentes
- [ ] Testar fluxo de autenticação Google de ponta a ponta — coberto no unit (`AuthenticateWithGoogle`) + smoke do redirect; E2E real com o Google pendente
- [ ] Testar regras de negócio RN01–RN08 manualmente com checklist
- [ ] Revisar tratamento de erros (respostas consistentes, sem vazar stack trace)
- [ ] Validar que nenhum dado sensível (tokens, sub do Google) vaza nas respostas da API.
- [ ] Rodar lint e corrigir todos os warnings antes do deploy

---

## Fase 11 — Deploy e Produção 🔴

- [ ] **Corrigir o ambiente da API no `docker-compose.yml`** — o serviço `api` declara as
      variáveis **inline** e não usa `env_file`, então não recebe `JWT_SECRET`,
      `GOOGLE_CLIENT_ID/SECRET`, `FRONTEND_URL` nem as de SMTP; o `.dockerignore` também
      exclui o `.env`, que portanto não entra na imagem. Como `middlewares/auth.ts` faz
      `new JwtService()` no escopo do módulo e o construtor lança sem `JWT_SECRET`, a API
      containerizada deve quebrar já no boot. Provável correção: `env_file: ./api/.env`.
      **Não verificado empiricamente** — hoje o dev roda a API por `npm run dev` no host
      (só o Postgres está no Docker), então o caminho containerizado não é exercitado.
- [ ] Escrever Dockerfile de produção da API
- [ ] Escrever build de produção do frontend (Vite build → estáticos)
- [ ] Configurar nginx na VPS: proxy reverso para a API + servir o frontend
- [ ] Configurar HTTPS com Let's Encrypt (certbot)
- [ ] Configurar variáveis de ambiente de produção na VPS
- [ ] Atualizar redirect URIs do Google OAuth para o domínio de produção
- [ ] Executar `prisma migrate deploy` na VPS
- [ ] Executar seed da instituição em produção
- [ ] Smoke test em produção: login → ministério → evento → escala → notificação
- [ ] Configurar backup do banco de dados
- [ ] Configurar logs e monitoramento básico
- [ ] Documentar o processo de deploy no README

---

## Fase 12 — Entregáveis do TCC e Documentação 🔴

- [ ] Manter o CLAUDE.md e este TASKS.md atualizados
- [ ] **Sincronizar a Seção 8 (env) do CLAUDE.md com o `.env.example`** — o `.env.example`
      (na raiz) está correto e mais completo; a Seção 8 do CLAUDE.md não lista
      `FRONTEND_URL`, `APP_LOGIN_URL`, `SEED_ADMIN_EMAIL` nem `SEED_ADMIN_NAME`. Quem
      seguir o CLAUDE.md sozinho monta um `.env` incompleto e o login pelo front não
      funciona (ver o item da `FRONTEND_URL` abaixo).
- [ ] **Adicionar `VITE_API_URL` ao `.env.example`** — o `web/src/services/http.ts` a
      consome (com fallback para `http://localhost:3001`, por isso passa despercebida em
      dev). Em produção o front precisa dela apontando para a API pública.
- [ ] Repositório com histórico de commits descritivos e tags por marco
- [ ] Sistema acessível via HTTPS no dia da banca
- [ ] **Validação intermediária** com o cliente (Apêndice A assinado)
- [ ] **Validação final** com o cliente (Apêndice B — nota 1–5 por RF)
- [ ] Garantir nota ≥ 3/5 nos RFs Essenciais
- [ ] Escrever a monografia/relatório:
  - [ ] Introdução e justificativa
  - [ ] Levantamento de requisitos
  - [ ] Decisões de arquitetura (incluindo o ajuste single-institution e Google-only)
  - [ ] Modelagem do banco (diagrama ER a partir do schema.prisma)
  - [ ] Detalhamento do motor de conflito centrado no membro
  - [ ] Processo de desenvolvimento e ferramentas (Claude Code, Docker, etc.)
  - [ ] Resultados da validação com o cliente
  - [ ] Conclusão e trabalhos futuros (apontar para a v2)
- [ ] Preparar a apresentação para a banca

---

## Apêndice — Escopo Futuro (v2) 🔵

> Documentado para a monografia (seção "trabalhos futuros") e para orientar a evolução.
> **Não implementar neste ciclo.** O schema já está preparado para receber estas mudanças.

- [ ] 🔵 Onboarding de novas instituições (tela de cadastro de tenant)
- [ ] 🔵 Fluxo de criação de tenant + definição do Admin Geral inicial
- [ ] 🔵 Resolver `instituicaoId` dinamicamente (por subdomínio ou seleção)
- [ ] 🔵 Convite de membros entre instituições
- [ ] 🔵 **Ingresso por código de acesso**: model `CodigoAcesso`, tela `/entrar`,
      geração de código pelo admin, ingresso self-service com perfil MEMBRO
- [ ] 🔵 Isolamento de dados real entre tenants (testes de segurança multitenant)
- [ ] 🔵 Billing / planos (se o produto for monetizado)
- [ ] 🔵 Suporte cross-institution (RF01.3)
- [ ] 🔵 Endurecer contra concorrência (dívida técnica adiada do MVP):
      • Adicionar `@@unique([ministerioId, nome])` ao model `Funcao` e a constraint
        equivalente de nome único ao model `Ministerio` — hoje a unicidade é só no
        código (use case), com janela de corrida teórica. (achado F2 de Funções, idêntico ao de Ministérios)
      • Tornar atômica a checagem-e-remoção no delete de `Funcao` (e revisar casos
        similares) para eliminar a race teórica que hoje poderia resultar em 500. (achado F3)

---

*Documento mestre — organizado por dependência lógica, sem prazos.*
*Projeto: Escacev · Cliente de validação: Igreja*
