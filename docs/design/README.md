# Design — Escacev

Pacote de design (handoff) que originou as telas do frontend.

| Arquivo | O que é |
|---------|---------|
| `handoff.md` | **A especificação.** Tokens, tipografia, layout e estados de cada tela. É a fonte a seguir ao implementar. |
| `Escacev.dc.login.html` | O protótipo de alta fidelidade que acompanha o handoff. |

## ⚠️ O protótipo NÃO abre no navegador

O `Escacev.dc.login.html` referencia um `./support.js` que **não veio no pacote**, e usa
tags próprias do runtime do Claude Design (`<sc-if>`, `<sc-for>`). Abrir o arquivo direto
mostra a página quebrada — isso é exportação incompleta, não corrupção.

Ele continua útil como **fonte de leitura**: os `style="..."` inline trazem os valores
exatos de cada elemento, e o `<script data-dc-script>` no fim traz os estados e as cores
computadas. Para ver o protótipo renderizado, é preciso abri-lo no Claude Design.

## O handoff.md tem imprecisões — o HTML é a fonte da verdade

Divergências encontradas ao implementar a tela de login. Onde os dois discordam, **vale
o HTML**:

- **Existe um preto QUENTE, `#2A2723`, que o handoff não documenta.** O `handoff.md`
  chama de `#1A1A1A` (preto neutro) o item ativo da sidebar, o chip de filtro
  selecionado e o anel da cor escolhida — mas o JS do protótipo usa `#2A2723` nos três.
  Todos os overlays e sombras também são `rgba(42, 39, 35, ·)`, que é esse mesmo tom.
  É ele que dá a temperatura do design. Está no `tailwind.config.js` como `ink-warm`.
- **Overlays:** o handoff diz `rgba(26,26,26,0.35)` / `rgba(26,26,26,0.4)`; o HTML usa
  `rgba(42,39,35,·)`.
- **`api_error`** é descrito como "googleSub ou e-mail ausentes na resposta do Google",
  mas na API real esse caminho é praticamente inalcançável — o controller já barra o
  e-mail ausente antes. Foi implementado como **fallback** para qualquer erro inesperado
  (ver `AuthController.toErrorKey`).

## O que é design e o que é vitrine

O protótipo apresenta as telas dentro de uma **moldura** (`border-radius: 20px` +
`box-shadow: 0 20px 50px -30px rgba(42,39,35,0.25)`), sobre uma página com o guia de
marca. Isso é **suporte de apresentação, não parte das telas** — no app real, o login é a
tela inteira. A moldura não foi reproduzida.

Pelo mesmo motivo, o seletor "Protótipo · simular erro" abaixo do card não existe no
produto: os estados de erro vêm do fluxo de auth real (`/login?error=<chave>`).

## Estado da implementação

- **Login** e **Callback** — implementados (`web/src/pages/`).
- **Painel** (shell com sidebar/topbar), **Ministérios**, **Funções** e **Membros** —
  especificados no `handoff.md`, ainda não implementados.
