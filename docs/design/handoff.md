# Handoff: Escacev — Sistema de gestão de escalas para igrejas

## Overview
Escacev é uma aplicação web (com navegação responsiva mobile) para gerenciar escalas de ministérios em igrejas: administradores cadastram ministérios, funções (papéis dentro de cada ministério) e membros, convidando pessoas por e-mail. Este pacote cobre a identidade visual e um protótipo interativo do fluxo de login e do painel administrativo (CRUD de Ministérios, Funções e Membros).

## About the Design Files
O arquivo incluso (`Escacev.dc.html`) é uma **referência de design em HTML** — um protótipo de alta fidelidade mostrando aparência e comportamento pretendidos, não código de produção para copiar diretamente. A tarefa é **recriar este design no ambiente da aplicação real** (framework escolhido pelo time — React, Vue, etc.), usando os padrões e bibliotecas já estabelecidos no projeto. Se ainda não houver um projeto/ambiente definido, escolha o framework mais adequado e implemente o design nele.

## Fidelity
**Alta fidelidade (hifi)**: cores, tipografia, espaçamento e interações finais. Recrie a UI com precisão a partir das especificações abaixo.

## Screens / Views

### 1. Login
- **Purpose**: ponto de entrada; único método de autenticação é OAuth com Google.
- **Layout**: tela cheia, fundo creme (#FBF6EE), cartão branco centralizado (max-width 360px), padding 48px 40px, border-radius 20px, border 1px solid #EAE2D4.
- **Components**:
  - Marca (ver "Assets/Logo") 48×48px, centralizada, margin-bottom 20px.
  - Título "Bem-vindo ao Escacev" — Sora 800, 24px, cor #1A1A1A.
  - Subtítulo "Gerencie as escalas do seu ministério, sem complicação." — Public Sans 400, 14px, cor #837B6E.
  - Botão "Entrar com Google": largura 100%, padding 13px 20px, border-radius 12px, border 1px solid #EAE2D4, fundo branco, ícone circular (swatch de 4 cores) + texto Public Sans 600 15px.
  - Rodapé: "Acesso restrito a convidados da sua igreja." — 12px, #B7AF9F.
  - Alerta de erro (condicional, acima do botão): banner fundo `#FDEDEB`, border 1px `#F3C6BE`, radius 10px, padding 12px 14px; ícone "!" em círculo vermelho (`#C0392B`, 18px) + texto 13px cor `#9B2C1E`. Estados de erro previstos:
    - **Falha na autenticação com o Google**: "Falha na autenticação com o Google. Tente novamente."
    - **Conta Google sem e-mail disponível**: "Conta Google sem e-mail disponível. Use uma conta com e-mail público para continuar."
    - **Usuário não autorizado**: "Usuário não autorizado — solicite um convite ao administrador do seu ministério." (provável causa: usuário não recebeu convite de acesso)
    - **Erro da API do Google** (`googleSub` ou e-mail ausentes na resposta): "Não foi possível concluir o login (googleSub é obrigatório | E-mail é obrigatório). Tente novamente em instantes."
- **Behavior**: clique no botão → em produção, inicia o OAuth do Google e navega para a tela de Callback; se a API/callback retornar erro, volta para o Login exibindo o alerta correspondente (sem reload de página).

Nota de implementação: o protótipo inclui um seletor "Protótipo · simular erro" abaixo do card, só para demonstrar os 4 estados — não deve ser recriado no produto real; usar o alerta acionado pelo fluxo de auth real.

### 2. Callback (OAuth)
- **Purpose**: tela de transição enquanto o token do Google é processado e o usuário é redirecionado.
- **Layout**: tela cheia centralizada (vertical/horizontal), fundo branco.
- **Components**: spinner circular 44px (borda 4px #EAE2D4, borda superior #1C7C8C, animação rotação contínua ~0.9s linear) + texto "Conectando com o Google…" (Public Sans 500, 14px, #837B6E, pulsando em opacidade).
- **Behavior**: após ~1.3s (no protótipo), navega automaticamente para o Painel (Ministérios). Em produção: receber o token OAuth, validar sessão, redirecionar para o painel.

### 3. Painel — shell (sidebar + topbar)
- **Layout desktop (≥861px)**: sidebar fixa à esquerda, 232px, fundo branco, border-right 1px #EAE2D4, padding 24px 16px. Conteúdo principal flex-1, padding 24px 28px 40px.
- **Layout mobile (≤860px)**: sidebar desktop escondida; topbar mostra botão hambúrguer (36×36px, border-radius 10px, border 1px #EAE2D4) que abre um drawer deslizante da esquerda (232px, mesmo conteúdo da sidebar), com overlay escuro (rgba(26,26,26,0.35)) atrás.
- **Sidebar contents**: logo (26px) + wordmark no topo; itens de navegação (Ministérios, Funções, Membros — item ativo com fundo #F5EFE2, texto #1A1A1A; inativo texto #837B6E); rodapé com avatar do usuário (círculo 32px, fundo #E3F0F1, texto #1C7C8C, iniciais), nome + papel, e link "Sair".
- **Topbar/header por página**: título (Sora 800, 22px) + subtítulo (13.5px, #837B6E) à esquerda; botão de ação primária à direita (fundo #1C7C8C, hover #145F6B, texto branco, Public Sans 600 13.5px, ícone "+").

### 4. Ministérios (lista + CRUD)
- **Purpose**: cadastrar/editar/remover ministérios (ex.: Louvor, Infantil, Recepção, Mídia).
- **Layout**: grid responsivo `repeat(auto-fill, minmax(240px, 1fr))`, gap 14px. Cada card: fundo branco, border 1px #EAE2D4, border-radius 14px, padding 18px.
- **Card contents**: dot de cor (10px) + nome (Sora 700, 15px); descrição (13px, #837B6E); contagem de membros (12px, #B7AF9F); ações "Editar" (#1C7C8C) e "Excluir" (#B7AF9F) — ao clicar em Excluir, o botão vira uma confirmação inline ("Confirmar exclusão" em vermelho #C0392B + "Cancelar").
- **Modal (criar/editar)**: overlay rgba(26,26,26,0.4), cartão branco 380px, campos Nome e Descrição (inputs 1px #EAE2D4, radius 10px), seletor de cor (5 swatches circulares: #1C7C8C, #1A1A1A, #C9962D, #8E5B9E, #3E7CB1 — selecionado com anel #1A1A1A). Botões Cancelar / Salvar.

### 5. Funções (lista + CRUD por ministério)
- **Purpose**: cadastrar papéis dentro de cada ministério (ex.: Vocal, Ministro de louvor, Operador de som).
- **Layout**: filtro por chips no topo ("Todos" + um por ministério — ativo: fundo #1A1A1A texto branco; inativo: fundo branco border #EAE2D4). Lista vertical de linhas (padding 14px 16px, border 1px #EAE2D4, radius 12px): nome (14px 700) + descrição (12.5px #837B6E) à esquerda; tag do ministério (pill colorida com a cor do ministério em 13% opacidade + texto na cor sólida); ações Editar/Excluir.
- **Modal**: campos Ministério (select), Nome da função, Descrição. Cancelar / Salvar.

### Estado de erro — Login
- `loginError: null | 'auth_failed' | 'no_email' | 'not_authorized' | 'api_error'`
- Setado quando o callback OAuth falha ou a API do Google retorna incompleta; limpo ao tentar login novamente.

### 6. Membros (lista + convite)
- **Purpose**: cadastrar membros e enviar convites de acesso.
- **Layout**: busca por nome/e-mail (input até 320px) acima da lista. Linhas: avatar com iniciais (34px, fundo #F5EFE2), nome + e-mail/ministério, tag de papel (Administrador geral: fundo #FBE6DE texto #C4431E · Administrador de grupo: fundo #E3F0F1 texto #1C7C8C · Membro: fundo #EFEBE3 texto #6B6456), tag de status (Ativo: fundo #E3F0F1 texto #1C7C8C · Convite enviado: fundo #FCEEE3 texto #B5651D), ações Editar/Remover.
- **Modal (convidar/editar)**: campos Nome, E-mail, Papel (select: Administrador geral / Administrador de grupo / Membro), Ministério (select). Botão principal: "Enviar convite" (novo) ou "Salvar" (edição). Ao enviar convite, o novo membro entra com status "Convite enviado".

## Interactions & Behavior
- Toda navegação entre Ministérios/Funções/Membros é client-side (sem reload).
- Exclusão de ministério exige confirmação inline em duas etapas (Excluir → Confirmar exclusão/Cancelar). Funções e Membros excluem direto (ajustar se o produto real exigir confirmação também).
- Busca de membros filtra em tempo real por nome ou e-mail (case-insensitive).
- Modais fecham ao clicar em "Cancelar" ou ao salvar com sucesso; validação simples (campos obrigatórios: nome, e-mail).
- Sidebar mobile: hambúrguer abre drawer; clique no overlay ou em um item de navegação fecha o drawer.

## State Management
- `view`: 'login' | 'callback' | 'app'
- `appView`: 'ministerios' | 'funcoes' | 'membros'
- `mobileMenuOpen`: boolean
- `ministries[]`: { id, name, description, color, memberCount }
- `roles[]`: { id, ministryId, name, description }
- `members[]`: { id, name, email, role, ministryId, status }
- `roleFilter`: id do ministério selecionado no filtro de Funções ('all' por padrão)
- `memberSearch`: string
- Estado de modal por entidade: `{ open, editingId, ...campos do formulário }`
- Em produção: substituir os arrays em memória por chamadas de API (listar/criar/editar/excluir) e o clique "Entrar com Google" por OAuth real + tela de callback recebendo o token.

## Design Tokens

### Cores
- Primária (teal): `#1C7C8C` — hover `#145F6B`
- Tinta/preto: `#1A1A1A`
- Fundo (creme): `#FBF6EE`
- Superfície: `#FFFFFF`
- Borda: `#EAE2D4`
- Texto secundário: `#837B6E`
- Texto terciário/placeholder: `#B7AF9F`
- Destaque neutro (hover/ativo sutil): `#F5EFE2`
- Teal claro (tags): `#E3F0F1`
- Âmbar (convite pendente): fundo `#FCEEE3` texto `#B5651D`
- Coral escuro (admin geral): fundo `#FBE6DE` texto `#C4431E`
- Neutro (papel "Membro"): fundo `#EFEBE3` texto `#6B6456`
- Perigo (excluir): `#C0392B`
- Cores de ministério (paleta de seleção): `#1C7C8C`, `#1A1A1A`, `#C9962D`, `#8E5B9E`, `#3E7CB1`

### Tipografia
- Display/títulos: **Sora** (Google Fonts), pesos 400/600/700/800
- Texto/UI: **Public Sans** (Google Fonts), pesos 400/500/600/700
- Tamanhos usados: 11–13px (metadados/tags), 13.5–15px (corpo/botões), 17–24px (títulos de seção), 36px (logotipo grande no guia de marca)

### Outros
- Border-radius: 10px (inputs/botões pequenos), 12–14px (cards), 16–20px (modais/cartões grandes)
- Sombra do painel do protótipo: `0 20px 50px -30px rgba(42,39,35,0.25)`

## Assets

### Logo
Marca "losango partido": um losango (diamante) maior na cor teal (`#1C7C8C`) com um triângulo menor preto (`#1A1A1A`) sobreposto na metade direita, formando duas metades assimétricas. Construído em SVG com `viewBox="0 0 52 52"`:
```html
<svg viewBox="0 0 52 52">
  <polygon points="26,4 48,26 26,48 4,26" fill="#1C7C8C"/>
  <polygon points="26,14 40,26 26,38 26,14" fill="#1A1A1A"/>
</svg>
```
Acompanhado do wordmark "Escacev" em Sora 800.
A paleta foi inspirada na logo da igreja Ação Evangélica (ACEV) — teal + preto sobre fundo branco/creme.

## Files
- `Escacev.dc.html` — protótipo completo (guia de marca + telas de Login, Callback e Painel com CRUD de Ministérios/Funções/Membros). Abra no navegador para ver o comportamento interativo; use como referência visual e funcional, não como código a ser reaproveitado diretamente.
