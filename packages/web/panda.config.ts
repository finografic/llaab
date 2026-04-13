import { designSystemPreset } from '@finografic/design-system/panda.preset';
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  /**
   * Disable Panda's built-in preflight — the DS reset.css (imported via global.css) handles it.
   */
  preflight: false,

  /**
   * Base utilities + the LLAAB design system preset (tokens, recipes, patterns).
   */
  presets: [designSystemPreset],

  /**
   * Scan all source files for used class names (tree-shaking).
   */
  include: ['./src/**/*.{ts,tsx,astro}'],
  exclude: [],

  /**
   * Output directory for generated utilities (gitignored).
   */
  outdir: 'styled-system',

  /**
   * React JSX helpers — enables <Box>, <Stack>, etc. from styled-system/jsx.
   */
  jsxFramework: 'react',

  syntax: 'object-literal',
  shorthands: true,
});
