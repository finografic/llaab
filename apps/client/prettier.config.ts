import * as prettierPluginAstro from 'prettier-plugin-astro';
import type { Config } from 'prettier';

export default {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  embeddedLanguageFormatting: 'auto',
  endOfLine: 'lf',
  htmlWhitespaceSensitivity: 'css',
  jsxSingleQuote: false,
  objectWrap: 'preserve',
  plugins: [prettierPluginAstro],
  printWidth: 110,
  proseWrap: 'preserve',
  quoteProps: 'consistent',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
  overrides: [
    {
      files: ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.json'],
      options: {
        printWidth: 110,
      },
    },
    {
      files: ['*.astro'],
      options: {
        parser: 'astro',
      },
    },
  ],
} satisfies Config;
