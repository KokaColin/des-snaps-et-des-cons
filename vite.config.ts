import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    // En développement, l'API et les WebSocket sont servis par `wrangler dev` (port 8787).
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
