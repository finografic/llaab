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
  overrides: [
    testOverrides,
    configOverrides,
    {
      // The shadcn drop-zone. `components.json` regenerates these files with `shadcn add`, so
      // hand-edits are lost on the next component update — relaxing the rules that only fire
      // because upstream's style differs from the house preset keeps the signal on code we own.
      //
      // Project-authored components live in subdirectories (elements/, grid/) and are fully linted.
      files: ['src/components/*.tsx'],
      rules: {
        // Upstream destructures `className`/`props`/`api`/`config` inside inner callbacks that
        // already exist in the outer scope.
        'eslint/no-shadow': 'off',
        // `_values` in slider.tsx.
        'eslint/no-underscore-dangle': 'off',
        // Render-prop maps over fixed-order payloads (recharts legend/tooltip, field errors) where
        // position is the identity.
        'react/no-array-index-key': 'off',
        // Context providers whose value is an object literal — worth fixing upstream, not here,
        // since the next `shadcn add` would drop the change.
        'react/jsx-no-constructed-context-values': 'off',
        // `components={{ ... }}` passed to react-day-picker: defined as props, never mounted as
        // elements by us.
        'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
        // TanStack Table's `useReactTable()` returns functions the React Compiler cannot memoize.
        'react/incompatible-library': 'off',
      },
    },
  ],
} satisfies OxlintConfig);
