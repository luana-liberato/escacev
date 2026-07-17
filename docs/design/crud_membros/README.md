# Handoff: Escacev — Layout base + tela de Membros (v3)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote entrega o **layout base reutilizável** (sidebar + header + perfil do usuário + toast de notificação) e a **tela de Membros** completa, para os 3 atores: Administrador geral, Administrador de grupo, Membro.

## About the Design File
`Escacev App.dc.html` é uma **referência de design em HTML** (protótipo interativo), não código de produção para copiar. Recrie no framework do projeto real (React, Vue, etc.), respeitando as regras de negócio da API (ver `.claude/CLAUDE.md` do projeto real, Seção 1 de RBAC).

## Fidelity
Alta fidelidade — cores, tipografia, espaçamento e interações finais.

## Modelo de dados (membro)
Não existe mais um campo único `profile`/"perfil". Um membro tem:
- `isGeneralAdmin: boolean` — poder de instituição (`ADMIN_GERAL`), não vem de nenhum vínculo de ministério.
- `ministryIds: string[]` — ministérios dos quais participa (pode ser escalado).
- `adminMinistryIds: string[]` — subconjunto de `ministryIds` onde administra (`MembroMinisterio.isAdmin`). **Ser admin de um ministério exige participar dele.**
- `status`: 'Ativo' | 'Convite pendente' (status "Desativado" fica fora de escopo por ora — não implementar).

`ADMIN_MINISTERIO` é **derivado**, não é escolhido: administra pelo menos um ministério → é admin de grupo; nenhum → é membro comum.

## Atores e permissões

| Ator | Nav | Membros — visualização | Membros — ações |
|---|---|---|---|
| Administrador geral | Agenda, Escalas, Eventos, Ministérios, Membros, Funções | Todos os membros, com filtro por ministério ("Todos" + um por ministério) | Convidar (fluxo A), Editar. Exclusão fora de escopo. |
| Administrador de grupo | mesmo nav | Somente membros dos ministérios que ele administra (pode administrar mais de um) | Convidar (fluxo B, escopado). Sem editar. |
| Membro | Agenda, Escalas, Eventos | (tela Membros não faz parte do nav do Membro) | — |

## Convite — dois fluxos distintos (não é a mesma tela com um botão a menos)

| | Administrador geral | Administrador de grupo |
|---|---|---|
| Escopo | A instituição | Sempre um ministério que ele administra — nunca cria "membro solto" |
| Campo de perfil | Não existe select de perfil (ver seção Modal) | Não existe — o convidado nasce `MEMBRO` |
| Ministério | Não obrigatório no convite | **Obrigatório** — select com **apenas os ministérios que o admin de grupo administra** |
| Endpoint sugerido | `POST /membros` | `POST /ministerios/:id/membros/convite` |

## Layout Shell

### Navegação (sidebar + drawer mobile)
- **Desktop (≥861px)**: sidebar fixa à esquerda, 232px, fundo branco, border-right 1px `#EAE2D4`, padding 24px 16px.
- **Mobile (≤860px)**: sidebar escondida; hambúrguer (36×36px, radius 10px, border 1px `#EAE2D4`) abre drawer deslizante da esquerda (232px, mesmo conteúdo), overlay escuro (`rgba(26,26,26,0.35)`).

### Bloco de usuário (rodapé da sidebar) — "Meu perfil"
Clicável (avatar 32px + nome + papel em pill destacado `#E3F0F1`/`#1C7C8C` + ícone de lápis sutil) — abre modal "Meu perfil" com campo Nome editável. Todos os atores podem editar o próprio nome.

### Toast de notificação (reusável)
Fixo no topo central, usado para qualquer confirmação de sucesso ou erro no sistema:
- Sucesso: fundo `#E3F0F1`, borda `#BFE0E2`, ícone check `#1C7C8C`, texto `#145F6B`.
- Erro: fundo `#FDEDEB`, borda `#F3C6BE`, ícone "!" `#C0392B`, texto `#9B2C1E`.
- Auto-dismiss ~3.5s ou fechamento manual (×). Estrutura: `{ type: 'success'|'error', message }`.

## Tela: Membros

### Cabeçalho
Botão "+ Convidar membro" visível para **Administrador geral e Administrador de grupo** (modais diferentes, ver acima).

### Filtros
Chips de ministério. Administrador geral vê todos; Administrador de grupo vê só os que ele administra (mais "Todos", escopado).

### Linha de membro
- Linha 1: avatar + nome (14px 700) + **badge "Administrador geral"** (só se `isGeneralAdmin`) + e-mail abaixo (12.5px). Nome, badge e e-mail com `white-space: nowrap` para não sobrepor.
- Linha 2 (quebra abaixo, `flex-basis: 100%`): chips de ministério — tom neutro (`#F5EFE2`/`#6B6456`); quando a pessoa administra aquele ministério, o chip muda para teal (`#E3F0F1`/`#1C7C8C`) e ganha o sufixo "· admin". **Não existe tag de perfil separada** — só o badge de Administrador geral e os chips.
- Tag de status: Ativo → `#E3F0F1`/`#1C7C8C`; Convite pendente → `#FCEEE3`/`#B5651D`.
- Ações (canto direito, nunca quebram): Editar (só Administrador geral). Botão "Promover" (só Administrador de grupo, ver abaixo).

### Promoção pelo Administrador de grupo
Botão "Promover" aparece por linha quando: o membro não é `isGeneralAdmin` E existe pelo menos um ministério que o admin de grupo administra, do qual o membro já participa, e no qual ainda não é admin. Fluxo em 2 passos:
1. Select do ministério (só ministérios elegíveis pela regra acima).
2. Confirmação explícita — irreversível ("Tem certeza... Essa ação não pode ser desfeita").
**Nunca** oferecer ministério que o admin de grupo não administra, nem um em que o membro não participa.

### Modal — Convidar (Administrador geral)
Campos: Nome, E-mail. Sem ministério obrigatório, sem select de perfil (perfil não existe mais como campo direto).

### Modal — Convidar (Administrador de grupo)
Campos: Nome, E-mail, **Ministério** (select obrigatório, só os que ele administra). O convidado nasce `Membro` desse ministério.

### Modal — Editar (só Administrador geral)
Campos: Nome, E-mail (**sempre somente leitura na edição**, texto estático em bloco cinza `#F5EFE2` + nota "E-mail não pode ser alterado após a ativação do membro."), botão "Promover a administrador geral" (some ao editar a si mesmo; **uma vez promovido, não é possível reverter** por este botão), e por ministério dois botões irmãos: "Adicionar"/"No ministério" (participação) e "+ Admin"/"Administrador" (promove admin daquele ministério; automaticamente adiciona a participação se ainda não existir).

**Botão "Rebaixar para Membro"**: aparece quando o membro editado tem `isGeneralAdmin` true ou algum `adminMinistryIds`, e a ação não é sobre si mesmo. Ao confirmar, zera `isGeneralAdmin` e **todos** os `adminMinistryIds` de uma vez (a participação nos ministérios é preservada — só o poder administrativo é removido).

Ao salvar/convidar com sucesso → toast de sucesso. Faltando campos obrigatórios → toast de erro.

## State Management
- `role`: 'admin_geral' | 'admin_grupo' | 'membro'
- `appView`, `mobileMenuOpen`, `ministryFilter`, `memberSearch`
- `members[]`: { id, name, email, status, isGeneralAdmin, ministryIds[], adminMinistryIds[] }
- `memberModal`: { open, editingId, name, email, isGeneralAdmin, ministryIds[], adminMinistryIds[], inviteMinistryId (fluxo admin de grupo) }
- `promoteModal`: { open, memberId, ministryId, step: 'select'|'confirm' }
- `profileModal`: { open, name }
- `toast`: { type: 'success'|'error', message } | null

## Design Tokens

### Cores
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A`
- Fundo (creme): `#FBF6EE`
- Superfície: `#FFFFFF`
- Borda: `#EAE2D4`
- Texto secundário: `#837B6E`
- Texto terciário: `#B7AF9F`
- Destaque neutro: `#F5EFE2`
- Teal claro (tags/admin): `#E3F0F1`
- Badge Administrador geral: `#FBE6DE`/`#C4431E`
- Erro/alerta: `#FDEDEB`/`#F3C6BE`/`#C0392B`/`#9B2C1E`

### Tipografia
Sora (títulos, 400/600/700/800) + Public Sans (texto, 400/500/600/700), Google Fonts.

### Outros
Border-radius: 10px (inputs/botões), 12–14px (cards), 16–20px (modais/cartões grandes).

## Assets — Logo
Losango partido: losango teal (`#1C7C8C`) + triângulo preto (`#1A1A1A`) sobreposto.
```html
<svg viewBox="0 0 52 52">
  <polygon points="26,4 48,26 26,48 4,26" fill="#1C7C8C"/>
  <polygon points="26,14 40,26 26,38 26,14" fill="#1A1A1A"/>
</svg>
```

## Files
- `Escacev App.dc.html` — único arquivo de referência válido. Shell de layout + tela de Membros completa; demais telas (Agenda, Escalas, Eventos, Ministérios, Funções) ainda são placeholders a construir.
