import { configOverrides, oxlintClientConfig, testOverrides } from '@finografic/oxc-config/oxlint';
import { defineConfig } from 'oxlint';
import type { OxlintConfig } from 'oxlint';

export default defineConfig({
  ...oxlintClientConfig,
  rules: {
    ...oxlintClientConfig.rules,
    // Side-effect CSS imports (global styles) are intentional.
    'import/no-unassigned-import': ['warn', { allow: ['**/*.css'] }],
  },
  options: {
    ...oxlintClientConfig.options,
    typeAware: undefined,
    typeCheck: undefined,
    reportUnusedDisableDirectives: undefined,
  },
  overrides: [testOverrides, configOverrides],
} satisfies OxlintConfig);
