import { resolve } from 'node:path';
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
    resolve: {
      // Force linked packages (pnpm link) to share a single instance of
      // React and Ark UI — prevents "invalid hook call" / multiple copies.
      // dedupe: ['react', 'react-dom', '@ark-ui/react'],
      extensions: ['.tsx', '.ts', '.js', '.mjs', '.json'],
      alias: {
        /**
         * Panda `@styled-system/*` — must match `compilerOptions.paths` in tsconfig.json.
         *
         * - TS/IDE: use tsconfig paths only.
         * - Vite/Rollup: keep these aliases too. `vite-tsconfig-paths` resolves paths for app source, but
         *   imports inside **linked** `@finografic/design-system/dist/*` still need explicit `resolve.alias`
         *   or the build fails with "failed to resolve @styled-system/css".
         */
        // '@styled-system/css': resolve('styled-system/css'),
        // '@styled-system/jsx': resolve('styled-system/jsx'),
        '@styled-system/css': resolve('styled-system/css'),
        '@styled-system/jsx': resolve('styled-system/jsx'),
        '@styled-system/recipes': resolve('./src/styled-system/recipes.ts'),
        // '@finografic/design-system/css': resolve('styled-system/css'),
        // '@finografic/design-system/jsx': resolve('styled-system/jsx'),
        // '@finografic/design-system/recipes': resolve(__dirname, 'src/styled-system/recipes.ts'),
      },
    },
  },
});
