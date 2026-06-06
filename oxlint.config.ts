/**
 * Oxlint — single root config (see docs/todo/DONE_OXLINT_MIGRATION.md).
 *
 * Editor schema: `oxlint`’s TS `defineConfig` type omits `$schema`; if you want JSON-schema IntelliSense in a
 * JSON config, use `.oxlintrc.json` with `"$schema": "./node_modules/oxlint/configuration_schema.json"`.
 *
 * Goals:
 *
 * - Mirror @finografic/eslint-config spirit (base + TS + imports) where oxlint has a rule.
 * - Mirror this repo’s eslint.config.ts for TS (stricter unused vars, consistent type imports).
 * - Stylistic / markdownlint rules stay in ESLint until you port or drop them.
 *
 * Reference package (do not link as a dep): ~/repos-finografic/@finografic-eslint-config
 *
 * Rules: Enable or disable rules, set severity, and configure rule options. categories: Enable groups of
 * rules with similar intent. plugins: Enable built-in plugins that provide additional rules. jsPlugins:
 * Configure JavaScript plugins (alpha). overrides: Apply different configuration to different file patterns.
 * extends: Inherit configuration from other files. ignorePatterns: Ignore additional files from the config
 * file. env: Enable predefined globals for common environments. globals: Declare custom globals as read-only
 * or writable. settings: Plugin-wide configuration shared by multiple rules. options: Linter-level options
 * (for example, options.typeAware and options.typeCheck).
 */

import { defineConfig } from 'oxlint';

export default defineConfig({
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.cursor/hooks/**',
    '**/.cursor/chats/**',
    '**/.claude/**',
    '**/coverage/**',
    '**/.astro/**',
  ],

  env: {
    builtin: true,
    node: true,
  },

  plugins: ['eslint', 'typescript', 'import', 'node'],

  options: {
    // typeCheck: true,
    typeAware: true,
    reportUnusedDisableDirectives: 'error',
  },

  rules: {
    // ── Aligned with @finografic/base (eslint-config) ─────────────────────────
    'eslint/no-debugger': 'error',
    'eslint/no-console': 'off',
    'eslint/no-constant-condition': ['error', { checkLoops: false }],
    'eslint/prefer-const': 'error',
    'eslint/no-var': 'error',
    'eslint/object-shorthand': 'error',
    'eslint/eqeqeq': ['error', 'always', { null: 'ignore' }],
    'eslint/curly': ['error', 'multi-line'],

    // Base unused-vars off for TS files; TS plugin owns them (matches eslint.config.ts pattern).
    'eslint/no-unused-vars': 'off',
    // 'eslint/no-redeclare': 'off',

    // ── TypeScript / @typescript-eslint parity (oxlint `typescript` plugin) ───
    // Stricter than finografic default: match eslint.config.ts (error, args: all, ignore _).
    'typescript/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    'typescript/no-redeclare': 'warn',
    'typescript/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
    ],
    // Opposite of inline `import { type T }`: require `import type { T }` (type keyword outside `{}`).
    'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],

    // Subset of @finografic/typescript layer — enable more as you confirm oxlint coverage.
    'typescript/adjacent-overload-signatures': 'error',
    // Finografic uses `array-simple`; oxlint may suggest `readonly T[]` vs `ReadonlyArray<T>` — warn only for Phase 1.
    'typescript/array-type': ['warn', { default: 'array-simple' }],
    'typescript/ban-ts-comment': 'warn',
    'typescript/consistent-type-assertions': 'error',
    'typescript/consistent-type-definitions': ['error', 'interface'],
    'typescript/no-array-constructor': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/no-this-alias': 'error',
    'typescript/prefer-as-const': 'error',
    'typescript/prefer-for-of': 'error',
    'typescript/prefer-function-type': 'error',
    'typescript/unified-signatures': 'error',
    'typescript/no-floating-promises': 'off',

    'typescript/await-thenable': 'error',

    // ── @finografic/node (JS tooling) — no direct TS equivalent in oxlint file set; keep in ESLint if needed.
    // 'node/no-process-exit': 'error',

    // ── Imports: finografic uses eslint-plugin-simple-import-sort; oxlint uses import-x style rules.
    // Tuned loosely to “external → package → relative” (adjust groups in a later pass).
    'import/no-duplicates': 'error',
    // Vitest / ESM hoisting often uses `vi.mock` before imports; finografic used simple-import-sort instead.
    'import/first': 'off',
    'import/no-amd': 'error',
    'import/no-self-import': 'error',
    // Side-effect CSS imports (Astro layouts, global styles) are intentional.
    'import/no-unassigned-import': ['error', { allow: ['**/*.css'] }],
  },

  overrides: [
    {
      files: ['eslint.config.ts'],
      rules: {
        // ESLint flat config commonly uses `/// <reference path="..." />` for ambient types.
        'typescript/triple-slash-reference': 'off',
      },
    },
    {
      files: ['_templates/feature/**'],
      rules: {
        'typescript/no-unused-vars': 'off',
        'typescript/consistent-type-imports': 'off',
        'import/consistent-type-specifier-style': 'off',
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      rules: {
        // Plain JS: use core unused-vars like finografic base (warn, after-used).
        'eslint/no-unused-vars': [
          'warn',
          {
            args: 'after-used',
            argsIgnorePattern: '^_',
            caughtErrors: 'all',
            caughtErrorsIgnorePattern: '^_',
            ignoreRestSiblings: true,
            vars: 'all',
            varsIgnorePattern: '^_',
          },
        ],
        'typescript/no-unused-vars': 'off',
        'typescript/consistent-type-imports': 'off',
        'typescript/no-redeclare': 'off',
      },
    },
  ],
});
