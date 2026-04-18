import { createColorTokens } from '@finografic/design-system/palette';
import { designSystemPreset } from '@finografic/design-system/panda.preset';
import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  /**
   * Disable Panda's built-in preflight — client already has
   *
   * @finografic/design-system/styles/reset.css imported in theme.css.
   */
  preflight: false,

  /**
   * Base Panda utilities + our design-system preset. Order matters: designSystemPreset overrides base tokens.
   */
  presets: ['@pandacss/dev/presets', designSystemPreset],

  /**
   * Scan for Panda CSS usage (css(), Box, recipes, etc.)
   *
   * Include design-system src so Panda extracts styles used in DS component files (components/, forms/,
   * etc.). Without it, CSS for those components won't be generated. With pnpm workspaces,
   *
   * @finografic/design-system resolves to the installed package.
   */
  include: [
    './src/**/*.{ts,tsx,astro}',
    './node_modules/@finografic/design-system/src/**/*.{ts,tsx}',
    // './node_modules/@finografic/design-system/dist/**/*.{ts,tsx}',
  ],
  exclude: [],

  theme: {
    ...designSystemPreset.theme,
    extend: {
      tokens: {
        ...(designSystemPreset.theme?.tokens ?? {}),
        // Override DS base colors with LLAAB's indigo theme.
        // createColorTokens merges these with BASE_COLORS_THEME defaults and rebuilds shade scales.
        // semanticColorTokens.accent.* reference {colors.primary.*} so they update automatically.
        colors: createColorTokens({
          primary: 'oklch(59% 0.234 277)', // indigo — matches --accent: #6366f1
          secondary: 'oklch(49.6% 0.265 301.924)',
          success: 'oklch(60.4% 0.194 149.214)',
          warning: 'oklch(71% 0.188 70.08)',
          danger: 'oklch(55.7% 0.245 27.325)',
          info: 'oklch(58.8% 0.158 241.966)',
          default: 'oklch(65.3% 0.013 58.071)',
          grey: 'oklch(55.2% 0.016 285.938)',
          text: 'oklch(28% 0 0)',
        }),
      },
    },
  },

  /**
   * Generate React JSX components from Panda patterns. Gives us <Box mx="4" py="2"> etc. with full token +
   * responsive support. Use Box for spacing/layout wrappers. Use Row/Col for flex grid layout.
   */
  jsxFramework: 'react',

  /**
   * Dark mode — match the client's existing EmotionThemeProvider which sets data-theme="dark" on
   * document.documentElement.
   *
   * This makes _dark conditions in semantic tokens and recipes generate: [data-theme="dark"] { --colors-bg: *
   * ...; } instead of the default `.dark { ... }`.
   */
  conditions: {
    extend: {
      dark: '[data-theme="dark"] &',
    },
  },

  // ======================================================================== //
  // NEW: https://panda-css.com/docs/references/config

  syntax: 'object-literal',
  // syntax: 'template-literal',
  shorthands: true,
});
