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
- [ ] Popular o seed com dados de teste mínimos (1 instituição, 1 admin geral, alguns ministérios e funções) para facilitar o desenvolvimento

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
- [ ] Implementar logout (no front: descartar o token)
- [x] Tratar o caso de login com e-mail Google que não corresponde a nenhum membro convidado
- [x] Evitar `Conta` órfã no fluxo 403: a `Conta` só é criada após confirmar o convite; o login também vincula Contas órfãs pré-existentes ao convite pendente

### Autorização (RBAC)
- [x] Middleware `auth`: validar JWT → injetar `req.user`
- [x] Middleware `rbac(...roles)`: verificar se `req.user.role` está autorizado
- [x] Middleware global `errorHandler`: capturar `AppError` e formatar resposta
- [x] Definir os três perfis no enum: `ADMIN_GERAL`, `ADMIN_MINISTERIO`, `MEMBRO`
- [ ] Garantir que rotas de membro restrinjam acesso apenas aos próprios dados quando aplicável

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
- [ ] Disparar e-mail de convite ao criar membro (integra com Fase 7)

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
      **O bloqueio (409) permanece apenas para o que é histórico ou compartilhado:**
      escalas do ministério (registro de quem serviu) e funções já usadas em
      `VagaEvento` (a vaga pertence ao evento, que é da instituição — apagar junto
      destruiria dados fora do ministério).

### Associação Membro ↔ Ministério, com papel de admin (RF03)
> **Mudança de schema:** adicionar `isAdmin Boolean @default(false)` ao model
> `MembroMinisterio`. Migration primeiro, depois código (disciplina de commits).
- [ ] Schema: adicionar `isAdmin Boolean @default(false)` em `MembroMinisterio` + migration
- [ ] Use case: associar membro a ministério, recebendo `isAdmin` opcional (padrão `false`)
- [ ] Use case: promover/rebaixar admin do ministério (alternar `isAdmin` numa associação existente)
- [ ] Use case: remover membro de ministério
- [ ] Use case: listar ministérios de um membro / membros de um ministério (indicando quem é admin)
- [ ] Endpoints: `POST /ministerios/:id/membros` (body aceita `isAdmin`),
      `PATCH /ministerios/:id/membros/:membroId/admin` (promover/rebaixar),
      `DELETE /ministerios/:id/membros/:membroId`
- [ ] Regra: existir a associação = participa (é escalável); `isAdmin = true` = também administra
- [ ] Convite escopado por ministério (endpoint POST /ministerios/:id/membros/convite):
      recebe { name, email, isAdmin? } e faz criar-ou-associar — e-mail novo cria o Membro
      e associa; e-mail existente fora do ministério só associa; e-mail já no ministério → 409.
      Reutiliza a criação de membro do bloco Membros (não duplica validação).
      ADMIN_MINISTERIO nunca cria membro "solto"; ADMIN_GERAL convida no nível da instituição.

### Permissão escopada de edição de ministério (RF03)
> Fecha a pergunta "o ADMIN_MINISTERIO edita o próprio ministério". Depende do
> `isAdmin` do bloco anterior — é o "voltar e afinar" da Forma A.
- [ ] Ajustar RBAC do `PUT /ministerios/:id`: permitir `ADMIN_GERAL` OU
      `ADMIN_MINISTERIO` com `isAdmin = true` naquele ministério
- [ ] Criar guarda reutilizável "é admin deste ministério" (usada aqui, em funções, em associações e nas escalas na Fase 5)
- [ ] Garantir que um admin não edita ministério em que não tem `isAdmin`

### Funções (RF03)
> Construído depois da associação para já nascer com o RBAC escopado (reusa a guarda "é admin deste ministério").
> **Atenção ao nome em inglês:** `role` já é o campo de perfil no JWT — não reusar "Role"
> para a função. Decidir entre `Position` ou `MinistryFunction`.
- [ ] Entidade da função + `create()` (nome em inglês a decidir — ver nota acima)
- [ ] Use cases: criar, listar, atualizar, remover função dentro de um ministério
- [ ] Endpoints: `POST /ministerios/:id/funcoes`, `GET /ministerios/:id/funcoes`, `PUT /funcoes/:id`, `DELETE /funcoes/:id`
- [ ] RBAC: gerenciar funções → `ADMIN_GERAL` OU admin escopado do ministério (`isAdmin = true`)

### Matriz de Compatibilidade de Funções (RN01, RN02)
- [ ] Entidade `CompatibilidadeFuncao` com regra de armazenamento `funcaoAId < funcaoBId`
- [ ] Use case: marcar par de funções como compatível
- [ ] Use case: remover compatibilidade (volta a ser incompatível por padrão)
- [ ] Use case: consultar compatibilidade entre duas funções
- [ ] Endpoints: `POST /funcoes/compatibilidade`, `DELETE /funcoes/compatibilidade`, `GET /funcoes/compatibilidade`
- [ ] Garantir o default: ausência de registro = funções incompatíveis

---

## Fase 4 — Eventos e Calendário 🔴

### Eventos (RF04)
- [ ] Entidade `Evento` + `create()` (validar `fim > inicio`)
- [ ] Use cases: criar, listar (com filtro por período), atualizar, remover evento
- [ ] Permitir criação por `ADMIN_GERAL` e `ADMIN_MINISTERIO`
- [ ] Suportar eventos simultâneos no calendário
- [ ] Endpoints: `POST /eventos`, `GET /eventos` (com query de período), `GET /eventos/:id`, `PUT /eventos/:id`, `DELETE /eventos/:id`

### Vagas por Evento (RF04)
- [ ] Entidade `VagaEvento` (funcaoId + quantidade)
- [ ] Use case: definir vagas por função em um evento (ex: 1 baterista, 2 vocais)
- [ ] Use case: listar e remover vagas de um evento
- [ ] Endpoints: `POST /eventos/:id/vagas`, `GET /eventos/:id/vagas`, `DELETE /vagas/:id`

---

## Fase 5 — Escalas e Motor de Conflito (NÚCLEO) 🔴

### Escalas (RF05)
- [ ] Entidade `Escala` + `create()` (status inicial RASCUNHO)
- [ ] Use case: criar escala (ministério + evento)
- [ ] Use case: buscar escala com suas alocações
- [ ] Use case: listar escalas (por evento, por ministério)
- [ ] Endpoints: `POST /escalas`, `GET /escalas`, `GET /escalas/:id`

### Alocações (RF05)
- [ ] Entidade `Alocacao` (escala + vaga + membro + flag conflito)
- [ ] Use case: alocar membro em uma vaga da escala
- [ ] Use case: remover alocação
- [ ] Validar que o membro pertence ao ministério da escala
- [ ] Validar que a vaga pertence ao evento da escala
- [ ] Endpoints: `POST /escalas/:id/alocacoes`, `DELETE /alocacoes/:id`

### Motor de Conflito (RN01, RN02, RN03, RN07) — coração do TCC
- [ ] Implementar serviço de detecção de conflito centrado no membro:
  - [ ] Dado um membro, buscar **todas** as suas alocações (em todos os ministérios)
  - [ ] Detectar sobreposição de horário: `novo.inicio < existente.fim AND novo.fim > existente.inicio`
  - [ ] Para cada sobreposição, checar a matriz de compatibilidade das funções envolvidas
  - [ ] Marcar conflito apenas quando as funções são incompatíveis (RN02)
  - [ ] Retornar detalhes claros: qual evento, qual escala, qual função conflita
- [ ] Aplicar prioridade por publicação: escala publicada primeiro tem precedência (RN07)
- [ ] Permitir que o admin confirme a alocação mesmo com conflito (RN03)
- [ ] Registrar a sobrescrita: `alocacao.conflito = true`
- [ ] Cobrir o motor de conflito com testes (Fase 10)

### Publicação de Escala (RN04)
- [ ] Use case: publicar escala → `status = PUBLICADA` + preencher `publicadaEm`
- [ ] Garantir que escala RASCUNHO seja invisível ao membro
- [ ] Use case: listar "minhas escalas" (apenas as PUBLICADAS onde o membro está alocado)
- [ ] Endpoints: `PATCH /escalas/:id/publicar`, `GET /minhas-escalas`
- [ ] Disparar notificação ao publicar (integra com Fase 7)

---

## Fase 6 — Indisponibilidade de Membros 🔴

### Indisponibilidade (RF06, RN05)
- [ ] Entidade `Indisponibilidade` + `create()` (validar período)
- [ ] Use case: membro registra período de indisponibilidade
- [ ] Use case: membro lista/remove suas indisponibilidades
- [ ] Use case: admin consulta indisponibilidades ao montar escala
- [ ] Integrar com o motor de conflito: **alertar** o admin ao tentar escalar membro indisponível no período (RN05)
- [ ] Permitir que o admin ignore o alerta e escale mesmo assim
- [ ] Endpoints: `POST /indisponibilidades`, `GET /indisponibilidades/minhas`, `DELETE /indisponibilidades/:id`
- [ ] Disparar alerta ao admin quando membro registra indisponibilidade que afeta escala já existente (integra com Fase 7)

### Sobrecarga (RN06) — pode ser tratada aqui ou no dashboard
- [ ] Definir limite configurável de escalas simultâneas por membro no período
- [ ] Alertar (não bloquear) quando o membro ultrapassar o limite

---

## Fase 7 — Notificações por E-mail 🔴

### Infraestrutura de e-mail (RF08)
- [ ] Configurar serviço de envio (Nodemailer + SMTP)
- [ ] Criar templates de e-mail (convite, escalado, lembrete, indisponibilidade-conflito)
- [ ] Entidade `Notificacao` (registro interno) + use case para criar/listar/marcar como lida

### Gatilhos de notificação (RF08, RN08)
- [ ] E-mail de **convite** ao cadastrar um novo membro
- [ ] E-mail ao membro quando é **escalado** em um evento (na publicação)
- [ ] **Lembrete** antes do evento (X horas antes — configurável)
- [ ] Alerta ao admin quando membro registra **indisponibilidade** que conflita com escala existente
- [ ] Endpoints internos: `GET /notificacoes`, `PATCH /notificacoes/:id/lida`
- [ ] Decidir mecanismo do lembrete (cron job / agendador na API)

---

## Fase 8 — Frontend 🔴

### Base
- [ ] Configurar roteamento (React Router)
- [ ] Configurar cliente HTTP (axios) com interceptor que injeta o JWT
- [ ] Configurar contexto/estado de autenticação (usuário logado, perfil)
- [ ] Implementar proteção de rotas por perfil
- [ ] Layout base: sidebar de navegação + header com usuário logado
- [ ] Tela de tratamento de erros e loading states reutilizáveis

### Autenticação
- [ ] Tela de login com botão "Entrar com Google"
- [ ] Tela de callback (recebe o token, redireciona para o painel)
- [ ] Fluxo de logout

### Telas de Gestão (Admin)
- [ ] Listagem e CRUD de **ministérios**
- [ ] Listagem e CRUD de **funções** por ministério
- [ ] Listagem e CRUD de **membros** (com envio de convite)
- [ ] Tela de associação de membros a ministérios
- [ ] Tela da **matriz de compatibilidade** de funções
- [ ] Listagem e CRUD de **eventos** com definição de vagas por função
- [ ] **Calendário** de eventos (visualização mensal/semanal ou lista)

### Telas de Escala
- [ ] Tela de **geração de escala**: selecionar evento, ministério, alocar membros nas vagas
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

- [ ] Testes unitários do **motor de conflito** (cenários: sem conflito, sobreposição compatível, sobreposição incompatível, prioridade por publicação)
- [ ] Testes unitários das entidades (validações de `create()`)
- [ ] Testes de integração dos principais fluxos (criar escala → alocar → publicar)
- [ ] Testar RBAC: cada perfil acessa apenas o que pode
- [ ] Testar fluxo de autenticação Google de ponta a ponta
- [ ] Testar regras de negócio RN01–RN08 manualmente com checklist
- [ ] Revisar tratamento de erros (respostas consistentes, sem vazar stack trace)
- [ ] Validar que nenhum dado sensível (tokens, sub do Google) vaza nas respostas da API.
- [ ] Rodar lint e corrigir todos os warnings antes do deploy

---

## Fase 11 — Deploy e Produção 🔴

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

---

*Documento mestre — organizado por dependência lógica, sem prazos.*
*Projeto: Escacev · Cliente de validação: Igreja*
