import type { CSSProperties } from 'react';

// `@pierre/diffs` ships its own theme; override via its documented CSS custom
// properties to match the app's dark theme tokens, same approach as `lib/pierre-trees-theme.ts`.
//
// Diff accent colors use Pierre Dark defaults — not semantic --success-text /
// --error-text, which look muddy when color-mixed into line backgrounds.
export const PIERRE_DIFFS_THEME_STYLE = {
  'height': '100%',
  '--diffs-font-size': '0.6875rem',
  '--diffs-line-height': '1.125rem',
  '--diffs-dark-bg': 'var(--bg)',
  '--diffs-bg-context-override': 'var(--bg-subtle)',
  '--diffs-bg-buffer-override': 'var(--bg-secondary)',
  '--diffs-bg-hover-override': 'var(--surface)',
  '--diffs-bg-separator-override': 'var(--border)',
  '--diffs-fg-number-override': 'var(--text-faint)',
  '--diffs-addition-color-override': '#3eCe81',
  '--diffs-deletion-color-override': '#ff5742',
} as CSSProperties;
