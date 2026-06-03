import path from 'node:path';
import node from '@astrojs/node';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const SERVER_URL = process.env['SERVER_URL'] ?? 'http://localhost:3000';
const OUT_DIR = process.env['LLAAB_CLIENT_OUT_DIR']
  ? path.resolve(process.env['LLAAB_CLIENT_OUT_DIR'])
  : './dist';

/**
 * SSR routes (`prerender = false`) and API routes require a server adapter at build time. Vite proxy: /api/*
 * → apps/server in dev (avoids CORS and client-side env var issues).
 */
export default defineConfig({
  output: 'server',
  outDir: OUT_DIR,
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        // Forward all /api/* to apps/server in dev. Astro-internal auth is handled
        // inline in login.astro (POST to self) so it never hits this proxy.
        '/api': SERVER_URL,
      },
    },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@llaab/ui': new URL('../../packages/ui/src', import.meta.url).pathname,
      },
    },
  },
});
