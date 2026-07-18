# Handoff: Escacev — Layout base + Membros + Ministérios + Funções (v5)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote entrega o layout base reutilizável e as telas de Membros, Ministérios e Funções (incluindo compatibilidade entre funções), para os 3 atores: Administrador geral, Administrador de grupo, Membro.

## About the Design File
`Escacev App.dc.html` é uma referência de design em HTML (protótipo interativo), não código de produção para copiar. Recrie no framework do projeto real.

## Fidelity
Alta fidelidade — cores, tipografia, espaçamento e interações finais.

## Modelo de dados
**Membro**: `{ id, name, email, status ('Ativo'|'Convite pendente'), isGeneralAdmin, ministryIds[], adminMinistryIds[] }`. `adminMinistryIds` ⊆ `ministryIds`. Uma pessoa pode administrar mais de um ministério.
**Ministério**: `{ id, name, description (opcional), color }`.
**Função**: `{ id, name, ministryId }` — pertence a um único ministério.
**Par de compatibilidade** (`rolePairs`): lista de pares `[roleIdA, roleIdB]`. Relação **simétrica** e **de padrão incompatível** — a ausência de um par significa que as duas funções ENTRAM EM CONFLITO (não podem ser exercidas pela mesma pessoa no mesmo evento). Um par pode ligar funções de ministérios diferentes.

## Atores e permissões

| Ator | Nav | Membros | Ministérios | Funções |
|---|---|---|---|---|
| Administrador geral | Agenda, Escalas, Eventos, Ministérios, Membros, Funções | vê todos, convida, edita | vê/cria/edita todos | vê/cria/edita/exclui todas; compatibilidade com todas as funções da instituição |
| Administrador de grupo | mesmo nav | vê só dos ministérios que administra; convida escopado; promove | vê os que participa; edita só os que administra | cria/edita/exclui só nos ministérios que administra; **mas na hora de marcar compatibilidade, vê e pode marcar contra TODAS as funções da instituição** (o par pode envolver função de outro ministério) |
| Membro | Agenda, Escalas, Eventos, Ministérios | fora do nav | vê só os que participa | fora do nav |

## Tela: Funções

### Listagem
Filtro por ministério (chips: Administrador geral vê todos; Administrador de grupo só os que administra). Linha: nome da função + chip do ministério (neutro `#F5EFE2`/`#6B6456`) + Editar + Excluir (confirmação inline em 2 etapas: "Excluir" → "Confirmar exclusão"/"Cancelar", mesmo padrão de Ministérios).

### Criar / Editar função — fluxo em 2 passos
**Passo 1 — formulário:**
- Nome da função (obrigatório)
- Ministério (select; Administrador geral vê todos, Administrador de grupo só os que administra)
- Banner de aviso fixo (mesmo estilo do banner de erro, tom `#FDEDEB`/`#9B2C1E`): "Por padrão, funções não marcadas abaixo **não podem** ser exercidas pela mesma pessoa no mesmo evento."
- Campo de busca de função (input) — necessário porque o domínio pode ter muitas funções.
- Lista de toggles, rótulo: `Marque as funções que podem ser exercidas em um mesmo evento com "{nome da função sendo criada/editada}"`. Cada linha: nome da função + chip do ministério dela + toggle (pill 42×24px, teal quando ativo). **A lista mostra TODAS as funções da instituição** (não filtra pelo escopo do admin de grupo) — exclui a própria função sendo editada. Toggle liga/desliga o par imediatamente no estado do formulário (efetivado só ao confirmar).
- Erro de validação (nome/ministério faltando) usa o banner de erro padrão do sistema, acima do campo Nome.
- Botão "Continuar" avança para confirmação (não salva ainda).

**Passo 2 — confirmação:**
- Mostra nome da função + resumo: "Poderá ser exercida junto com: X, Y, Z. Todas as demais funções continuam em conflito com ela." (ou, se nenhuma marcada: "Nenhuma outra função foi marcada... entrará em conflito com todas as demais.")
- Botões "Voltar" (retorna ao passo 1 preservando os toggles) e "Confirmar" (salva função + pares e fecha o modal).
- Ao confirmar → toast de sucesso ("Função criada/atualizada com sucesso.").

## Layout Shell (reaproveitado em todas as telas)
- Sidebar 232px (≥861px, fundo branco, border-right `#EAE2D4`) / drawer + hambúrguer + overlay `rgba(26,26,26,0.35)` (≤860px).
- Bloco "Meu perfil" no rodapé da sidebar (clicável, edita o próprio nome).
- Toast global fixo no topo: sucesso `#E3F0F1`/`#145F6B`, erro `#FDEDEB`/`#9B2C1E`, auto-dismiss ~3.5s.

## Telas: Membros e Ministérios
Ver especificação completa nos handoffs anteriores (v3/v4) — sem mudanças nesta entrega, exceto que agora convivem com a nova aba Funções no mesmo shell.

## Design Tokens
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A` · Fundo (creme): `#FBF6EE` · Superfície: `#FFFFFF` · Borda: `#EAE2D4`
- Texto secundário: `#837B6E` · Texto terciário: `#B7AF9F` · Destaque neutro: `#F5EFE2`
- Teal claro (tags/ativo): `#E3F0F1` · Badge Administrador geral: `#FBE6DE`/`#C4431E`
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
- `Escacev App.dc.html` — único arquivo de referência válido. Shell + Membros + Ministérios + Funções (com compatibilidade) completos; Agenda, Escalas e Eventos ainda são placeholders a construir.
