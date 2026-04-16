import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

const SERVER_URL = process.env['SERVER_URL'] ?? 'http://localhost:3000';

/**
 * SSR routes (`prerender = false`) and API routes require a server adapter at build time. Vite proxy: /api/*
 * → apps/server in dev (avoids CORS and client-side env var issues).
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        '/api': SERVER_URL,
      },
    },
  },
});
