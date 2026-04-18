import { designSystemPreset } from '@finografic/design-system/panda.preset';
import { createColorTokens } from '@finografic/design-system/tokens';
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

  theme: {
    extend: {
      tokens: {
        // Override DS base colors with LLAAB's indigo theme.
        // createColorTokens merges these with BASE_COLORS_THEME defaults and rebuilds shade scales.
        // semanticColorTokens.accent.* reference {colors.primary.*} so they update automatically.
        colors: createColorTokens({
          primary: 'oklch(59% 0.234 277)', // indigo — matches --accent: #6366f1
        }),
      },
    },
  },

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
