# Handoff: Escacev — Layout base (sidebar + header)

## Overview
Escacev é uma aplicação web responsiva para gestão de escalas de ministérios em igrejas. Este pacote entrega o **layout base reutilizável**: sidebar de navegação + header com usuário logado, usado por todos os atores (Administrador geral, Administrador de grupo, Membro).

## About the Design File
`Escacev App.dc.html` é uma **referência de design em HTML** (protótipo interativo), não código de produção para copiar. Recrie no framework do projeto real (React, Vue, etc.).

## Fidelity
Alta fidelidade — cores, tipografia, espaçamento e interações finais.

## Layout Shell

### Navegação (sidebar + drawer mobile)
Todos os atores têm o mesmo menu: **Agenda, Escalas, Eventos, Ministérios, Membros, Funções** (nessa ordem).
- **Desktop (≥861px)**: sidebar fixa à esquerda, 232px, fundo branco, border-right 1px `#EAE2D4`, padding 24px 16px. Logo + wordmark no topo; itens de nav (ativo: fundo `#F5EFE2`, texto `#1A1A1A`; inativo: texto `#837B6E`); rodapé com avatar do usuário (círculo 32px, fundo `#E3F0F1`, texto `#1C7C8C`, iniciais) + nome + papel; link "Sair".
- **Mobile (≤860px)**: sidebar escondida; botão hambúrguer (36×36px, radius 10px, border 1px `#EAE2D4`) abre drawer deslizante da esquerda (232px, mesmo conteúdo), com overlay escuro (`rgba(26,26,26,0.35)`) atrás. Clique no overlay ou em um item de nav fecha o drawer.

### Header por página
Título (Sora 800, 22px) + subtítulo (13.5px, `#837B6E`) à esquerda do conteúdo principal. Cada tela injeta sua própria ação primária no header (botão "+", conforme a tela).

### Container do protótipo
Cartão branco, border 1px `#EAE2D4`, radius 20px, sombra `0 20px 50px -30px rgba(26,26,26,0.25)`.

## State Management
- `role`: 'admin_geral' | 'admin_grupo' | 'membro' (define nome/avatar exibidos; nav é igual para os três nesta versão)
- `appView`: 'agenda' | 'escalas' | 'eventos' | 'ministerios' | 'membros' | 'funcoes'
- `mobileMenuOpen`: boolean

## Design Tokens

### Cores
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A`
- Fundo (creme): `#FBF6EE`
- Superfície: `#FFFFFF`
- Borda: `#EAE2D4`
- Texto secundário: `#837B6E`
- Texto terciário: `#B7AF9F`
- Destaque neutro (hover/ativo sutil): `#F5EFE2`
- Teal claro (avatar/tags): `#E3F0F1`

### Tipografia
- Display/títulos: **Sora** (Google Fonts), pesos 400/600/700/800
- Texto/UI: **Public Sans** (Google Fonts), pesos 400/500/600/700

### Outros
- Border-radius: 10px (inputs/botões), 12–14px (cards), 16–20px (modais/cartões grandes)

## Assets

### Logo
Marca "losango partido": losango maior em teal (`#1C7C8C`) com triângulo preto (`#1A1A1A`) sobreposto na metade direita.
```html
<svg viewBox="0 0 52 52">
  <polygon points="26,4 48,26 26,48 4,26" fill="#1C7C8C"/>
  <polygon points="26,14 40,26 26,38 26,14" fill="#1A1A1A"/>
</svg>
```
Acompanhado do wordmark "Escacev" em Sora 800.

## Files
- `Escacev App.dc.html` — shell de layout (sidebar/drawer + header) com seletor "visualizar como" para simular os 3 atores. Telas de conteúdo (Agenda, Escalas, Eventos, Ministérios, Membros, Funções) ainda são placeholders — a construir nas próximas etapas.
