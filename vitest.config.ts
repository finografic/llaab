import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@llaab/schemas': resolve(__dirname, 'packages/schemas/src/index.ts'),
      '@llaab/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@llaab/control': resolve(__dirname, 'packages/control/src/index.ts'),
      '@llaab/ingestion': resolve(__dirname, 'packages/ingestion/src/index.ts'),
      '@llaab/llm': resolve(__dirname, 'packages/llm/src/index.ts'),
      '@llaab/skills': resolve(__dirname, 'packages/skills/src/index.ts'),
      // Client path aliases, mirroring apps/client/tsconfig.json. Longest-prefix first: Vite matches
      // aliases in order, so 'components/ui/*' must precede the broader 'components/*'.
      'components/ui': resolve(__dirname, 'packages/ui/src/components'),
      'components': resolve(__dirname, 'apps/client/src/components'),
      'forms': resolve(__dirname, 'apps/client/src/forms'),
      'lib': resolve(__dirname, 'apps/client/src/lib'),
      'providers': resolve(__dirname, 'apps/client/src/providers'),
      'queries': resolve(__dirname, 'apps/client/src/queries'),
      'utils': resolve(__dirname, 'apps/client/src/utils'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'apps/server/**/*.test.ts',
      // Pure client utils only — component tests would need a DOM environment and jsdom.
      'apps/client/**/*.test.ts',
    ],
  },
});
