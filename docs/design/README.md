# Design — Escacev

Pacote de design (handoff) que originou as telas do frontend.

Os handoffs chegam em rodadas. **O mais recente manda** — ver "Divergências entre
rodadas" abaixo.

| Arquivo | O que é |
|---------|---------|
| `handoff.md` | 1ª rodada: **login** (+ um esboço do painel que foi superado). Tokens, tipografia, layout e estados. |
| `Escacev.dc.login.html` | O protótipo da 1ª rodada. |
| `layout_sidebar/README.md` | 2ª rodada: **layout base** (sidebar + header). Supera o esboço de painel da 1ª. |
| `layout_sidebar/Escacev App.dc.html` | O protótipo do layout base. É o arquivo que vale nesta pasta. |
| `layout_sidebar/Escacev.dc.html` | Cópia do protótipo da 1ª rodada — **ignorar**, está superado e contradiz o vizinho. |

## ⚠️ O protótipo NÃO abre no navegador

O `Escacev.dc.login.html` referencia um `./support.js` que **não veio no pacote**, e usa
tags próprias do runtime do Claude Design (`<sc-if>`, `<sc-for>`). Abrir o arquivo direto
mostra a página quebrada — isso é exportação incompleta, não corrupção.

Ele continua útil como **fonte de leitura**: os `style="..."` inline trazem os valores
exatos de cada elemento, e o `<script data-dc-script>` no fim traz os estados e as cores
computadas. Para ver o protótipo renderizado, é preciso abri-lo no Claude Design.

## Divergências entre rodadas

**Temperatura das cores — a 2ª rodada esfriou.** A 1ª usa `rgba(42,39,35, ·)` (preto
quente, `#2A2723`) em todo overlay e sombra, e nos estados interativos. A 2ª usa
`rgba(26,26,26, ·)` e `#1A1A1A` — o `#2A2723` **não aparece uma única vez**. Ao
implementar o layout base, vale a 2ª. O token `ink-warm` do `tailwind.config.js` nasceu
da 1ª e está órfão até isso ser decidido.

**A navegação cresceu de 3 para 6 itens.** A 1ª rodada tinha Ministérios, Funções e
Membros (painel só de admin). A 2ª tem Agenda, Escalas, Eventos, Ministérios, Membros e
Funções, para todos os atores.

**⚠️ O menu da 2ª rodada conflita com o RBAC da API.** O JS declara o mesmo `nav` para
`admin_geral`, `admin_grupo` e `membro`, e o README diz "nav é igual para os três nesta
versão". Mas a API responde **403** a um MEMBRO em `/ministerios`, `/membros`, `/funcoes`
e `/escalas` — quatro dos seis itens. Decidido com a cliente: o membro **não** vê
Ministérios, Membros e Funções; **Escalas ele precisa ver** (as suas e as do seu
ministério), o que exige mudança na API — hoje `GET /escalas` é admin-only, e só
`GET /minhas-escalas` é aberto.

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

- **Login** e **Callback** — implementados (`web/src/pages/`), incluindo telas pequenas.
- **Layout base** (sidebar + drawer mobile + header) — especificado na 2ª rodada, **a
  construir**. Depende do `GET /membros/me` (nome e iniciais do rodapé da sidebar) e da
  decisão do menu por perfil.
- **Agenda, Escalas, Eventos, Ministérios, Membros, Funções** — só placeholders no
  protótipo da 2ª rodada; nenhuma foi desenhada por dentro ainda.
