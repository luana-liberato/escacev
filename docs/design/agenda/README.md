# Handoff: Escacev — Agenda + Disponibilidade (v8)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote foca na tela **Agenda** (calendário mensal, todos os atores) e no sistema de **disponibilidade dos membros**, reaproveitando o shell e os tokens já entregues (Membros, Ministérios, Funções, Eventos, Escalas).

## About the Design File
`Escacev App.dc.html` é referência de design em HTML (protótipo interativo), não código de produção. Recrie no framework real. Nota: usa uma data de referência fixa (`NOW_REF = 19/07/2026`) só para manter a demo consistente; no app real use a data atual.

## Modelo de dados (novo)
**Indisponibilidade**: `{ id, memberId, date, allDay: boolean, startTime, endTime }`. Por padrão é o dia todo (`allDay: true`, `00:00`–`23:59`); o usuário pode restringir a um período (ex.: só de manhã). Uma pessoa tem no máximo um registro por data (editar substitui). Todos os atores podem marcar a própria indisponibilidade.

**Regra de conflito por indisponibilidade**: uma pessoa é considerada indisponível para um evento se houver registro na data do evento e (`allDay` OU o intervalo `startTime–endTime` se sobrepõe ao horário do evento).

## Tela: Agenda (todos os atores)
Calendário mensal com navegação ‹ mês › e legenda de cores:
- **Aberto** (evento sem relação com o usuário): tom terroso vivo `#E7DFCB`/`#5C5340`.
- **Você escalado** (sem conflito): teal sólido `#1C7C8C`/branco.
- **Você escalado com conflito**: âmbar dourado vivo `#F0C550`/`#5C4813`.
- **Indisponibilidade marcada** (dia inteiro do usuário): fundo do dia em vermelho claro `#FDEDEB` + borda `#F3C6BE` + marca "✕" vermelha no canto do número do dia.

Clique no dia abre um painel abaixo do calendário com:
- Lista de eventos daquele dia (nome, horário, status colorido); quando o usuário está escalado, mostra chips "Ministério · Função" (dourado se em conflito).
- Botão vermelho: **"Marcar indisponibilidade"** (se não há registro nesse dia) OU **"Desfazer indisponibilidade"** sólido vermelho (se já há — some direto, sem precisar abrir modal).
- Botões "+ Evento" e "+ Escala" — **somente Administrador geral e de grupo** — pré-preenchem a data escolhida nos respectivos modais de criação.

### Modal de indisponibilidade
Toggle "Dia todo" (padrão ligado) ou período customizado (dois campos de hora "de"/"até"). Botões Cancelar / Salvar, e "Remover" quando já existe registro para editar/apagar.

## Impacto da indisponibilidade nas Escalas
- No painel "Adicionar à escala", o seletor de Pessoa **exclui** quem está indisponível na data/horário do evento daquela escala.
- Na **lista de Escalas**, uma escala com alguém indisponível alocado ganha badge vermelho sólido "Membro indisponível" e borda/fundo vermelhos no card (prioridade visual sobre os destaques de "você escalado"/conflito).
- No **detalhe da escala**, a linha da pessoa indisponível fica com borda lateral vermelha, nome em vermelho e badge "Indisponível" — distinto do badge/borda amarela de "Conflito" (indisponibilidade é mais grave que conflito de agenda).

## Cores de estado (resumo)
- Aberto: `#E7DFCB`/`#5C5340` · Escalado: `#1C7C8C`/branco · Escalado em conflito: `#F0C550`/`#5C4813`
- Indisponibilidade: vermelho do sistema `#FDEDEB`/`#F3C6BE`/`#C0392B`
- Conflito de escala (selo, ícone, revisar conflitos): vermelho do sistema também (mesma paleta), diferenciado por rótulo, não por cor, do estado de indisponibilidade
- Alerta pendente de decisão ("Escalar mesmo assim"): âmbar `#8A6D1F`/`#FBF0D9`

## Layout Shell (reaproveitado)
Sidebar 232px / drawer mobile + hambúrguer + overlay `rgba(26,26,26,0.35)`. Bloco "Meu perfil". Toast global (sucesso `#E3F0F1`/`#145F6B`, erro `#FDEDEB`/`#9B2C1E`, ~3.5s).

## Design Tokens
Primária (teal) `#1C7C8C` (hover `#145F6B`) · Preto `#1A1A1A` · Creme `#FBF6EE` · Superfície `#FFFFFF` · Borda `#EAE2D4` · Texto secundário `#837B6E` · terciário `#B7AF9F` · destaque neutro `#F5EFE2` · teal claro `#E3F0F1`. Tipografia: Sora (títulos) + Public Sans (texto). Radius: 10px inputs/botões, 12–14px cards, 16–20px modais.

## Files
- `Escacev App.dc.html` — referência única e válida. Contém Layout base + Membros + Ministérios + Funções + Eventos + Escalas + Agenda + Disponibilidade completos.
