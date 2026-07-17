# Handoff: Escacev — Layout base + Membros + Ministérios (v4)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote entrega o **layout base reutilizável** (sidebar + header + perfil do usuário + toast de notificação) e as telas de **Membros** e **Ministérios**, para os 3 atores: Administrador geral, Administrador de grupo, Membro.

## About the Design File
`Escacev App.dc.html` é uma **referência de design em HTML** (protótipo interativo), não código de produção para copiar. Recrie no framework do projeto real (React, Vue, etc.).

## Fidelity
Alta fidelidade — cores, tipografia, espaçamento e interações finais.

## Modelo de dados (membro)
Não existe um campo único `profile`/"perfil". Um membro tem:
- `isGeneralAdmin: boolean` — poder de instituição, não vem de nenhum vínculo de ministério.
- `ministryIds: string[]` — ministérios dos quais participa (pode ser escalado).
- `adminMinistryIds: string[]` — subconjunto de `ministryIds` onde administra. **Ser admin de um ministério exige participar dele.** Uma pessoa pode administrar mais de um ministério.
- `status`: 'Ativo' | 'Convite pendente' (status "Desativado" fora de escopo por ora).

`ADMIN_MINISTERIO` é **derivado**: administra pelo menos um ministério → é admin de grupo; nenhum → é membro comum.

## Modelo de dados (ministério)
`{ id, name, description (opcional), color }` — sem outros campos por ora.

## Atores e permissões

| Ator | Nav | Membros | Ministérios |
|---|---|---|---|
| Administrador geral | Agenda, Escalas, Eventos, Ministérios, Membros, Funções | Vê todos, filtro por ministério, convida (sem select de perfil/ministério), edita | Vê todos; cria; edita qualquer um |
| Administrador de grupo | mesmo nav | Vê membros dos ministérios que administra (pode ser mais de um); convida escopado a um ministério que administra; promove | Vê os que participa (administra ou só é escalado); edita só os que administra |
| Membro | Agenda, Escalas, Eventos, Ministérios | tela Membros fora do nav | Vê só os que participa; sem editar/criar |

## Convite — dois fluxos distintos

| | Administrador geral | Administrador de grupo |
|---|---|---|
| Campos | Nome, E-mail | Nome, E-mail, **Ministério** (obrigatório, só os que ele administra) |
| Resultado | Convidado sem vínculo de ministério ainda | Convidado nasce membro do ministério escolhido |

## Layout Shell
- **Sidebar (≥861px)**: 232px, fundo branco, border-right 1px `#EAE2D4`. **Drawer mobile (≤860px)**: hambúrguer abre painel deslizante 232px + overlay `rgba(26,26,26,0.35)`.
- **Bloco de usuário** (rodapé sidebar): clicável → modal "Meu perfil" (editar o próprio nome; qualquer ator).
- **Toast reusável** (topo central, fixo): sucesso (`#E3F0F1`/`#145F6B`) e erro (`#FDEDEB`/`#9B2C1E`), auto-dismiss ~3.5s. Usar para qualquer confirmação do sistema.

## Tela: Membros
- Header: botão "+ Convidar membro" (Administrador geral e de grupo, modais diferentes conforme acima).
- Filtros por ministério (Administrador geral vê todos; de grupo só os que administra).
- Linha: avatar + nome + badge "Administrador geral" (só se aplicável) + e-mail; chips de ministério (neutro `#F5EFE2`/`#6B6456`; quando a pessoa administra aquele ministério, chip vira teal `#E3F0F1`/`#1C7C8C` com sufixo "· admin"); tag de status.
- Ações: "Editar" (só Administrador geral). "Promover" (só Administrador de grupo) — aparece quando o membro não é admin geral e existe pelo menos um ministério que o admin de grupo administra + o membro participa + ainda não é admin lá. Fluxo em 2 passos: seleção de ministério → confirmação irreversível.
- Modal Editar (Administrador geral): Nome, E-mail (**sempre somente leitura na edição**), botão "Promover a administrador geral" (irreversível; some ao editar a si mesmo), por ministério dois botões — "Adicionar"/"No ministério" (participação) e "+ Admin"/"Administrador" (promove admin, garante participação), e "Rebaixar para Membro" (zera admin geral + todos os `adminMinistryIds` de uma vez; não aparece ao editar a si mesmo).

## Tela: Ministérios
- Cards em grid: nome + badge "Você administra" (quando aplicável, borda do card também destaca em teal 2px) + descrição (se houver) + linha "Administradores: fulano, ciclano (você)".
- Botão "Editar" no card: visível para Administrador geral (qualquer ministério) e para Administrador de grupo **apenas nos ministérios que ele administra**. Abre o mesmo modal de criar (Nome + Descrição opcional), reaproveitado para edição.
- Botão "+ Novo ministério" no header: só Administrador geral, só na aba Ministérios.
- Estados vazios com mensagem por ator: Administrador de grupo sem ministério administrado / Membro sem ministério vinculado.

## State Management
- `role`, `appView`, `mobileMenuOpen`, `ministryFilter`, `memberSearch`
- `members[]`: { id, name, email, status, isGeneralAdmin, ministryIds[], adminMinistryIds[] }
- `memberModal`: { open, editingId, name, email, isGeneralAdmin, ministryIds[], adminMinistryIds[], inviteMinistryId }
- `promoteModal`: { open, memberId, ministryId, step: 'select'|'confirm' }
- `ministryModal`: { open, editingId, name, description }
- `profileModal`: { open, name }
- `toast`: { type: 'success'|'error', message } | null

## Design Tokens
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A` · Fundo (creme): `#FBF6EE` · Superfície: `#FFFFFF` · Borda: `#EAE2D4`
- Texto secundário: `#837B6E` · Texto terciário: `#B7AF9F` · Destaque neutro: `#F5EFE2`
- Teal claro (admin/tags): `#E3F0F1` · Badge Administrador geral: `#FBE6DE`/`#C4431E`
- Erro/alerta: `#FDEDEB`/`#F3C6BE`/`#C0392B`/`#9B2C1E`
- Tipografia: Sora (títulos, 400/600/700/800) + Public Sans (texto, 400/500/600/700), Google Fonts.
- Border-radius: 10px (inputs/botões), 12–14px (cards), 16–20px (modais).

## Assets — Logo
```html
<svg viewBox="0 0 52 52">
  <polygon points="26,4 48,26 26,48 4,26" fill="#1C7C8C"/>
  <polygon points="26,14 40,26 26,38 26,14" fill="#1A1A1A"/>
</svg>
```

## Files
- `Escacev App.dc.html` — único arquivo de referência válido. Shell + Membros + Ministérios completos; demais telas (Agenda, Escalas, Eventos, Funções) ainda são placeholders a construir.
