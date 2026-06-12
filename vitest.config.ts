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
    },
  },
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/server/**/*.test.ts'],
  },
});
