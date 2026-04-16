/// <reference path="./declarations.d.ts" />
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import markdownlintPlugin from 'eslint-plugin-markdownlint';
import markdownlintParser from 'eslint-plugin-markdownlint/parser.js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.cursor/hooks/**',
    '**/.cursor/chats/**',
    '**/.claude/**',
  ]),

  js.configs.recommended,

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['_templates/feature/**'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      '@stylistic': stylistic,
      'import': importPlugin,
    },
    rules: {
      // Disable base rules in favor of TS-aware ones
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      'no-console': 'off',

      '@typescript-eslint/no-unused-vars': [
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
      '@typescript-eslint/no-redeclare': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      // Match oxlint: forbid `import { type X }`; use `import type { X }` instead.
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],

      '@stylistic/indent': ['warn', 2, { SwitchCase: 1, ignoredNodes: ['ConditionalExpression'] }],
      '@stylistic/operator-linebreak': [
        'warn',
        'after',
        { overrides: { '?': 'ignore', ':': 'ignore', '|': 'ignore' } },
      ],
      '@stylistic/multiline-ternary': ['warn', 'always-multiline'],
    },
  },

  {
    files: ['**/*.md'],
    ignores: ['node_modules/**', 'dist/**', '.cursor/**'],
    languageOptions: {
      parser: markdownlintParser,
    },
    plugins: {
      'markdownlint': markdownlintPlugin as Linter.Processor,
      '@stylistic': stylistic,
    },
    // processor: markdownlintPlugin.processors.markdown,
    rules: {
      ...markdownlintPlugin.configs.recommended.rules,
      'markdownlint/md001': 'off', // heading increment
      'markdownlint/md004': 'off', // Unordered list style
      'markdownlint/md012': 'off', // Multiple consecutive blank lines
      'markdownlint/md013': 'off', // Line length
      'markdownlint/md024': 'off', // Duplicate headings
      'markdownlint/md025': 'off', // Single h1
      'markdownlint/md026': 'off', // Trailing punctuation in heading
      'markdownlint/md029': 'off', // List style
      'markdownlint/md036': 'off', // No emphasis as heading
      'markdownlint/md040': 'off', // Fenced code language
      'markdownlint/md041': 'off', // First line heading
      'markdownlint/md043': 'off', // Required heading structure
      'markdownlint/md045': 'off', // images require alt text

      // Formatting consistency
      '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multi-spaces': ['error', { exceptions: { Property: true } }],
    },
  },

  {
    files: ['_templates/feature/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      'import/consistent-type-specifier-style': 'off',

      'import/no-unresolved': 'off',
      'no-undef': 'off',
    },
  },
]);
