import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const clientRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const serverUrl = env['SERVER_URL'] ?? 'http://localhost:3000';
  const devHost = env['HOST'] ?? '127.0.0.1';
  const devPort = Number(env['PORT'] ?? 4321);

  return {
    envDir: repoRoot,
    envPrefix: ['VITE_', 'SERVER_'],
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: '@llaab/ui', replacement: path.resolve(repoRoot, 'packages/ui/src') },
        { find: /^utils\/(.*)/, replacement: `${path.resolve(clientRoot, 'src/utils')}/$1` },
        { find: 'utils', replacement: path.resolve(repoRoot, 'packages/ui/src/lib/utils.ts') },
        { find: /^hooks\/(.*)/, replacement: `${path.resolve(repoRoot, 'packages/ui/src/hooks')}/$1` },
        { find: /^ui\/(.*)/, replacement: `${path.resolve(repoRoot, 'packages/ui/src/components')}/$1` },
        {
          find: /^components\/ui\/(.*)/,
          replacement: `${path.resolve(repoRoot, 'packages/ui/src/components')}/$1`,
        },
        { find: /^components\/(.*)/, replacement: `${path.resolve(clientRoot, 'src/components')}/$1` },
        { find: 'constants', replacement: path.resolve(clientRoot, 'src/constants') },
        { find: 'dialogs', replacement: path.resolve(clientRoot, 'src/dialogs') },
        { find: 'forms', replacement: path.resolve(clientRoot, 'src/forms') },
        { find: 'layouts', replacement: path.resolve(clientRoot, 'src/layouts') },
        { find: 'lib', replacement: path.resolve(clientRoot, 'src/lib') },
        { find: 'providers', replacement: path.resolve(clientRoot, 'src/providers') },
        { find: 'queries', replacement: path.resolve(clientRoot, 'src/queries') },
        { find: 'routes', replacement: path.resolve(clientRoot, 'src/routes') },
        { find: 'styles', replacement: path.resolve(clientRoot, 'src/styles') },
        { find: 'tables', replacement: path.resolve(clientRoot, 'src/tables') },
      ],
    },
    server: {
      host: devHost,
      port: devPort,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
