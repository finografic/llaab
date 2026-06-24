import type { CSSProperties } from 'react';

// `@pierre/diffs` ships its own theme; override via its documented CSS custom
// properties to match the app's dark theme tokens, same approach as `lib/pierre-trees-theme.ts`.
export const PIERRE_DIFFS_THEME_STYLE = {
  'height': '100%',
  '--diffs-bg-context-override': 'transparent',
  '--diffs-bg-buffer-override': 'var(--bg-secondary)',
  '--diffs-bg-hover-override': 'var(--surface)',
  '--diffs-bg-separator-override': 'var(--border)',
  '--diffs-fg-number-override': 'var(--text-faint)',
  '--diffs-bg-addition-override': 'var(--success-bg)',
  '--diffs-bg-addition-emphasis-override': 'var(--success-bg)',
  '--diffs-bg-addition-number-override': 'var(--success-bg)',
  '--diffs-addition-color-override': 'var(--success-text)',
  '--diffs-fg-number-addition-override': 'var(--success-text)',
  '--diffs-bg-deletion-override': 'var(--error-bg)',
  '--diffs-bg-deletion-emphasis-override': 'var(--error-bg)',
  '--diffs-bg-deletion-number-override': 'var(--error-bg)',
  '--diffs-deletion-color-override': 'var(--error-text)',
  '--diffs-fg-number-deletion-override': 'var(--error-text)',
} as CSSProperties;
