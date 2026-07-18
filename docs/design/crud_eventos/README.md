# Handoff: Escacev — Layout base + Membros + Ministérios + Funções + Eventos (v6)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote entrega o layout base reutilizável e as telas de Membros, Ministérios, Funções (com compatibilidade) e Eventos, para os 3 atores: Administrador geral, Administrador de grupo, Membro.

## About the Design File
`Escacev App.dc.html` é uma referência de design em HTML (protótipo interativo), não código de produção para copiar. Recrie no framework do projeto real.

## Fidelity
Alta fidelidade — cores, tipografia, espaçamento e interações finais.

## Modelo de dados
**Membro**: `{ id, name, email, status ('Ativo'|'Convite pendente'), isGeneralAdmin, ministryIds[], adminMinistryIds[] }`.
**Ministério**: `{ id, name, description (opcional), color }`.
**Função**: `{ id, name, ministryId }`.
**Par de compatibilidade** (`rolePairs`): pares `[roleIdA, roleIdB]`, simétrico, padrão-incompatível (ausência de par = conflito no mesmo evento).
**Evento** (novo): `{ id, name, type, startsAt, endsAt }`.
- `name`: obrigatório.
- `type`: um de 6 valores fixos — Culto, Ensaio, Especial, Reunião, Café, Conferência.
- `startsAt`/`endsAt`: data+hora ISO. **Término deve ser depois do início** (validado no salvar).
- Evento é escopo de **instituição**, não de ministério.

## Atores e permissões

| Ator | Nav | Eventos |
|---|---|---|
| Administrador geral | Agenda, Escalas, Eventos, Ministérios, Membros, Funções | cria, edita, exclui — mesmas ações do admin de grupo |
| Administrador de grupo | mesmo nav | cria, edita, exclui — **sem distinção de permissão frente ao admin geral nesta tela** |
| Membro | Agenda, Escalas, Eventos, Ministérios | fora de escopo desta entrega (se aparecer, é somente leitura) |

(Membros/Ministérios/Funções mantêm as regras das entregas anteriores — v5.)

## Tela: Eventos

### Cabeçalho
Título "Eventos", subtítulo "Calendário de eventos da instituição". Botão "+ Novo evento" (Administrador geral e de grupo).

### Filtros
Chips no topo: "Todos" + um por tipo (6), mesmo estilo dos filtros de Funções/Membros.

### Listagem
Cronológica (mais próximo primeiro). Linha: nome (destaque) + chip do tipo (cor própria, ver tokens abaixo) + "Dom, 20/07 · 19h00–21h00" + Editar/Excluir. Exclusão com confirmação inline em 2 etapas (padrão já usado em Ministérios/Funções).

**Regra de exclusão**: se o evento tiver escalas vinculadas, a exclusão falha e mostra toast de erro ("Não é possível excluir: há escalas vinculadas a este evento.") em vez de remover.

### Estados
- Vazio: card tracejado creme — "Nenhum evento cadastrado ainda."
- Erro de validação no modal: banner de erro padrão do sistema.

### Modal — Criar/Editar (form direto, sem passo de confirmação)
Campos: Nome (obrigatório), Tipo (select, 6 opções), Início (data + hora), Término (data + hora). Validação: nome obrigatório; término > início — senão banner de erro padrão. Botões Cancelar / "Salvar evento" (label muda para "Criar evento" ao criar). Sucesso → toast.

### Cores por tipo de evento (chip fundo/texto)
- Culto: `#E3F0F1` / `#145F6B`
- Ensaio: `#EAF2E3` / `#4F7A3A`
- Especial: `#E6EDF9` / `#3E5C8C`
- Reunião: `#F5EFE2` / `#6B6456`
- Café: `#F6E4D2` / `#9B5E33`
- Conferência: `#EEE3F2` / `#7A4C8C`

## Layout Shell (reaproveitado em todas as telas)
- Sidebar 232px (≥861px) / drawer + hambúrguer + overlay `rgba(26,26,26,0.35)` (≤860px).
- Bloco "Meu perfil" no rodapé da sidebar (edita o próprio nome).
- Toast global fixo no topo: sucesso `#E3F0F1`/`#145F6B`, erro `#FDEDEB`/`#9B2C1E`, auto-dismiss ~3.5s.

## Design Tokens
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A` · Fundo (creme): `#FBF6EE` · Superfície: `#FFFFFF` · Borda: `#EAE2D4`
- Texto secundário: `#837B6E` · Texto terciário: `#B7AF9F` · Destaque neutro: `#F5EFE2`
- Teal claro (tags/ativo): `#E3F0F1` · Badge admin geral: `#FBE6DE`/`#C4431E`
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
- `Escacev App.dc.html` — único arquivo de referência válido. Shell + Membros + Ministérios + Funções + Eventos completos; Agenda e Escalas ainda são placeholders a construir.
