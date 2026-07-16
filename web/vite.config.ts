import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Alias @/ -> src/. Precisa existir aqui (bundler) E no tsconfig (typecheck):
    // o tsconfig sozinho só ensina o TS, o Vite continuaria sem resolver o import.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // expõe na rede (necessário dentro do container)
    port: 5173,
  },
});
