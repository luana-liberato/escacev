/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // Fronteira do layout base: sidebar fixa a partir de 861px; até 860px ela
        // vira drawer com hambúrguer (docs/design/layout_sidebar/README.md).
        nav: '861px',
      },
      // Design tokens do handoff (docs/design/handoff.md).
      // Paleta inspirada na logo da igreja Ação Evangélica: teal + preto sobre creme.
      colors: {
        brand: {
          DEFAULT: '#1C7C8C', // primária (teal)
          hover: '#145F6B',
          soft: '#E3F0F1', // teal claro — tags
        },
        ink: '#1A1A1A', // preto — títulos e texto forte
        // Preto QUENTE (amarronzado). Não está no README do handoff — extraído do
        // JS do protótipo, que o usa nos estados interativos (item ativo da
        // sidebar, chip de filtro selecionado, anel da cor escolhida) e em todo
        // overlay/sombra, via rgba(42,39,35,·). O README chama tudo isso de
        // #1A1A1A; o protótipo discorda, e é ele que define a temperatura.
        'ink-warm': '#2A2723',
        cream: '#FBF6EE', // fundo
        line: '#EAE2D4', // borda
        muted: '#837B6E', // texto secundário
        faint: '#B7AF9F', // texto terciário / placeholder
        highlight: '#F5EFE2', // hover / ativo sutil
        danger: '#C0392B', // excluir / ícone de erro
        alert: {
          bg: '#FDEDEB', // banner de erro — fundo
          border: '#F3C6BE',
          text: '#9B2C1E',
        },
        // Toast de sucesso: reusa brand-soft no fundo e brand-hover no texto; só
        // a borda é um tom próprio.
        toast: {
          'success-border': '#BFE0E2',
        },
        // Tags de perfil do membro (docs/design/crud_membros).
        role: {
          'geral-bg': '#FBE6DE',
          'geral-fg': '#C4431E',
          'grupo-bg': '#E3F0F1',
          'grupo-fg': '#1C7C8C',
          'membro-bg': '#EFEBE3',
          'membro-fg': '#6B6456',
        },
        // Tag de status "Convite pendente".
        pending: {
          bg: '#FCEEE3',
          fg: '#B5651D',
        },
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'], // títulos
        sans: ['"Public Sans"', 'sans-serif'], // texto/UI
      },
      // Sombras e overlays do protótipo. Todos usam o preto QUENTE (42,39,35 =
      // #2A2723), nunca preto neutro — é o que dá a temperatura do design.
      boxShadow: {
        panel: '0 20px 50px -30px rgba(42, 39, 35, 0.25)',
        drawer: '12px 0 30px rgba(42, 39, 35, 0.15)',
        toast: '0 12px 30px -12px rgba(26, 26, 26, 0.3)',
      },
      spacing: {
        4.5: '18px', // padding horizontal do toast
      },
      backgroundColor: {
        overlay: 'rgba(42, 39, 35, 0.4)', // fundo de modal
        'overlay-soft': 'rgba(42, 39, 35, 0.35)', // fundo do drawer mobile
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        // Spinner e texto da tela de callback (0.9s / 1.6s no handoff).
        'spin-slow': 'spin 0.9s linear infinite',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
