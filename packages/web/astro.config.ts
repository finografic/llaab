import node from '@astrojs/node';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

/** SSR routes (`prerender = false`) and API routes require a server adapter at build time. */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
});
