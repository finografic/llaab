import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const clientRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)));
const API_PROXY_TIMEOUT_MS = 10 * 60 * 1000;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const serverUrl = env['LLAAB_API_URL'] ?? 'http://localhost:8888';
  const devHost = env['HOST'] ?? '127.0.0.1';
  const devPort = Number(env['PORT'] ?? 5050);
  const outDir = process.env['LLAAB_CLIENT_OUT_DIR']
    ? path.resolve(process.env['LLAAB_CLIENT_OUT_DIR'])
    : path.resolve(clientRoot, 'dist');

  return {
    envDir: repoRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        {
          find: /^kokoro-js$/,
          replacement: path.resolve(clientRoot, 'node_modules/kokoro-js/dist/kokoro.web.js'),
        },
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
        { find: 'types', replacement: path.resolve(clientRoot, 'src/types') },
      ],
    },
    server: {
      host: devHost,
      port: devPort,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          timeout: API_PROXY_TIMEOUT_MS,
          proxyTimeout: API_PROXY_TIMEOUT_MS,
        },
        '/terminal/ws': {
          target: serverUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: devHost,
      port: devPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
          timeout: API_PROXY_TIMEOUT_MS,
          proxyTimeout: API_PROXY_TIMEOUT_MS,
        },
        '/terminal/ws': {
          target: serverUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir,
      emptyOutDir: true,
    },
    worker: {
      format: 'es',
    },
  };
});
