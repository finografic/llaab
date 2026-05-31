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
    ssr: {
      // Bundle these for SSR — prevents Node from loading them from the design
      // system's own node_modules and picking up a second React instance.
      noExternal: ['@finografic/design-system', '@ark-ui/react', '@zag-js/react'],
    },
    resolve: {
      // Force a single React 19 instance across all linked packages.
      dedupe: ['react', 'react-dom'],
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
        // ======================================================================== //
        '@styled-system/css': resolve('styled-system/css'),
        '@styled-system/jsx': resolve('styled-system/jsx'),
        '@styled-system/recipes': resolve('./src/styled-system/recipes.ts'),
        // '@finografic/design-system/recipes': resolve(__dirname, 'src/styled-system/recipes.ts'),
        // ======================================================================== //
        // '@styled-system/styles.css': resolve('styled-system/styles.css'),
        // '@styled-system/css': resolve('styled-system/css'),
        // '@styled-system/jsx': resolve('styled-system/jsx'),
        // ======================================================================== //
      },
    },
  },
});
