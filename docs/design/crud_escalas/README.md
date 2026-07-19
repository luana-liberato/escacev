# Handoff: Escacev — Escalas (v7)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote foca na tela de **Escalas** — lista + detalhe (construtor de alocações) — reaproveitando o shell e os tokens já entregues (Membros, Ministérios, Funções, Eventos).

## About the Design File
`Escacev App.dc.html` é uma referência de design em HTML (protótipo interativo), não código de produção. Recrie no framework do projeto real. Nota: o protótipo usa uma data de referência fixa (`NOW_REF = 19/07/2026`) em vez do relógio real, só para manter a demo consistente com os dados de exemplo — no app real, use a data atual.

## Modelo de dados
**Evento**: `{ id, name, type, startsAt, endsAt }` — âncora de tempo; a escala herda a data do evento.
**Escala**: `{ id, ministryId, eventId, label (opcional), status: 'Rascunho'|'Publicada', allocations[] }`. Um ministério pode ter várias escalas no mesmo evento (rótulos tipo "Berçário", "Sala 1"). Sem rótulo = escala única do ministério.
**Alocação**: `{ id, memberId, roleId, conflict: boolean }` — uma pessoa numa função dentro da escala.

## Atores e permissões
- **Administrador geral** e **Administrador de grupo**: montam escalas. Admin de grupo só nos ministérios que administra (ações escondidas fora do escopo). Ambos criam, editam alocações, publicam.
- **Membro**: **somente leitura**; só vê escalas com status "Publicada"; só dos ministérios em que participa (não vê rascunhos nem ministérios de terceiros). Vê "Revisar conflitos" (read-only) mesmo sem poder gerenciar.

## Tela 1 — Lista de Escalas

### Cabeçalho
"Escalas" / "Escalas dos ministérios por evento". Botão "+ Nova escala" (admins).

### Controles de período (topo)
- Select nativo "Dia / Semana / Mês" + setas ‹ › que navegam o período à esquerda/direita, com label textual completo: dia = "19 de julho de 2026"; semana = intervalo "13 de julho de 2026 – 19 de julho de 2026"; mês = "Julho de 2026". Todos inicializam a partir da data de referência/atual (não hardcoded).
- Botão "Minhas escalas" (todos os atores) — toggle sólido quando ativo (fundo teal `#1C7C8C`, texto branco) — filtra para mostrar só escalas em que o usuário logado está alocado.
- Filtros por ministério e status (chips) — **ocultos para o Membro** (ele não filtra, só vê o que já é dele).

### Listagem
Cronológica pelo evento. Passadas (antes de "hoje") ficam com opacidade reduzida (~0.55) e vão para o final da lista, mesmo dentro do período filtrado.
Cada linha: **nome da escala em destaque** (rótulo/label se houver, senão o nome do evento) — evento e horário aparecem como texto secundário abaixo, tom mais claro (`#B7AF9F`). Chip do ministério (neutro). Badge de status (Rascunho `#F5EFE2`/`#6B6456`; Publicada `#E3F0F1`/`#145F6B`). Contagem de alocados.

**Indicador "está escalado"**: quando o usuário logado tem alocação na escala — borda lateral esquerda de 4px + fundo levemente tintado + ícone circular com "✓" ao lado do nome. Cor **teal** se a alocação dele não está em conflito; **âmbar** (`#8A6D1F`/fundo `#FBF0D9`) se está em conflito — e nesse caso aparece também o rótulo "Conflito com escala" ao lado do nome da escala.

Estado vazio: card tracejado creme — "Nenhuma escala criada ainda."

### Modal "Nova escala"
- Select de Ministério (só os que o admin administra).
- **Calendário em miniatura** navegável (mês a mês): dias com evento cadastrado ficam destacados (fundo `#E3F0F1`, texto `#145F6B`, clicáveis); dias sem evento não são clicáveis. Ao clicar num dia, ele fica selecionado (fundo teal sólido).
- Select de **Evento** só aparece/preenche **depois** de uma data ser selecionada, filtrado para eventos daquele dia. Antes de selecionar uma data: texto "Selecione uma data no calendário para escolher o evento."
- Campo "Nome da escala (opcional)".
- Validação (banner de erro padrão, nesta ordem): ministério obrigatório → data obrigatória → evento obrigatório.
- Botão "Criar escala" → cria e abre direto o detalhe da nova escala.

## Tela 2 — Detalhe da escala

### Cabeçalho
Nome do evento + badge de status (não quebram linha entre si) — horário e ministério como subtítulo; rótulo da escala abaixo se houver. Ações à direita: "Revisar conflitos" (aparece p/ qualquer ator se houver conflito nesta escala — vermelho `#FDEDEB`/`#C0392B`), "Publicar" (só admins, só rascunho).

### Alocações
Cada linha: nome + chip da função (neutro) + Editar/Remover (confirmação inline em 2 etapas, só admins). Quando em conflito: borda lateral vermelha + ícone circular "!" vermelho + selo "Conflito" (vermelho, não âmbar — o vermelho é reservado à alocação já confirmada em conflito).
Estado vazio: "Nenhuma pessoa escalada ainda."

### Adicionar à escala (só admins)
Select de Pessoa (membros do ministério) + Select de Função (funções do ministério) + botão "Adicionar". Três respostas possíveis:
1. **OK** → entra na lista, toast de sucesso.
2. **Inválido** (duplicada) → toast de erro, curto, sem reenvio.
3. **Alerta de conflito de horário** (não é erro) → cartão em **âmbar** listando os outros compromissos sobrepostos (evento/ministério/função/horário) + botões "Cancelar" / "Escalar mesmo assim". Ao confirmar, a alocação entra marcada com o selo "Conflito" (vermelho, ver acima).

### Revisar conflitos (modal read-only, vermelho)
Relista as alocações em conflito da escala com os detalhes das outras ocorrências sobrepostas; marca qual "tem prioridade" (a de escala publicada antes). Sem ações — só "Fechar". Acessível a qualquer ator.

### Publicar (confirmação, só admins)
Avisa que é definitiva (não dá pra despublicar), que fica visível aos membros e que eles serão notificados. Ao confirmar: toast de sucesso, badge muda para "Publicada", **volta para a lista de escalas**.

## Cores de estado
- Status Rascunho: `#F5EFE2`/`#6B6456` · Status Publicada: `#E3F0F1`/`#145F6B`
- "Está escalado" (sem conflito): teal `#1C7C8C`
- "Está escalado" em conflito / "Conflito com escala": âmbar `#8A6D1F` / fundo `#FBF0D9`
- Alerta de decisão pendente (aguardando "Escalar mesmo assim"): âmbar `#8A6D1F`/`#FBF0D9`
- Conflito já confirmado (selo, ícone, revisar conflitos): vermelho do sistema `#FDEDEB`/`#F3C6BE`/`#C0392B`/`#9B2C1E`
- Erro irrecuperável: mesmo vermelho do sistema

## Layout Shell (reaproveitado)
Sidebar 232px / drawer mobile + hambúrguer + overlay `rgba(26,26,26,0.35)`. Bloco "Meu perfil". Toast global (sucesso `#E3F0F1`/`#145F6B`, erro `#FDEDEB`/`#9B2C1E`, ~3.5s).

## Design Tokens
Primária (teal) `#1C7C8C` (hover `#145F6B`) · Preto `#1A1A1A` · Creme `#FBF6EE` · Superfície `#FFFFFF` · Borda `#EAE2D4` · Texto secundário `#837B6E` · terciário `#B7AF9F` · destaque neutro `#F5EFE2` · teal claro `#E3F0F1`. Tipografia: Sora (títulos) + Public Sans (texto). Radius: 10px inputs/botões, 12–14px cards, 16–20px modais.

## Files
- `Escacev App.dc.html` — referência única e válida. Contém Layout base + Membros + Ministérios + Funções + Eventos + Escalas completos.
