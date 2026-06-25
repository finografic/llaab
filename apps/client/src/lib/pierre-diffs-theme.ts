import type { CSSProperties } from 'react';

// `@pierre/diffs` ships its own theme; override via its documented CSS custom
// properties to match the app's dark theme tokens, same approach as `lib/pierre-trees-theme.ts`.
export const PIERRE_DIFFS_THEME_STYLE = {
  'height': '100%',
  '--diffs-font-size': '0.6875rem',
  '--diffs-line-height': '1.125rem',
  '--diffs-dark': 'color-mix(in oklab, var(--text) 82%, var(--text-muted))',
  '--diffs-bg-context-override': 'transparent',
  '--diffs-bg-buffer-override': 'var(--bg-secondary)',
  '--diffs-bg-hover-override': 'var(--surface)',
  '--diffs-bg-separator-override': 'var(--border)',
  '--diffs-fg-number-override': 'var(--text-faint)',
  '--diffs-bg-addition-override': 'color-mix(in oklch, var(--success-text) 88%, var(--accent))',
  '--diffs-bg-addition-emphasis-override': 'color-mix(in oklch, var(--success-text) 54%, transparent)',
  '--diffs-bg-addition-number-override': 'var(--success-text)',
  '--diffs-addition-color-override': 'var(--success-text)',
  '--diffs-fg-number-addition-override': 'var(--success-text)',
  '--diffs-bg-deletion-override': 'color-mix(in oklch, var(--error-text) 86%, var(--warning-text))',
  '--diffs-bg-deletion-emphasis-override': 'color-mix(in oklch, var(--error-text) 54%, transparent)',
  '--diffs-bg-deletion-number-override': 'var(--error-text)',
  '--diffs-deletion-color-override': 'var(--error-text)',
  '--diffs-fg-number-deletion-override': 'var(--error-text)',
} as CSSProperties;
