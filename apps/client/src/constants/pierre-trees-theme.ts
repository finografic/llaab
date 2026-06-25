import type { CSSProperties } from 'react';

// `@pierre/trees` ships its own light-mode default theme; override via its documented
// CSS custom properties to match the app's dark theme tokens instead of forking its CSS.
export const PIERRE_TREE_THEME_STYLE = {
  'height': '100%',
  '--trees-bg-override': 'transparent',
  '--trees-bg-muted-override': 'var(--bg-secondary)',
  '--trees-fg-override': 'var(--text)',
  '--trees-fg-muted-override': 'var(--text-muted)',
  '--trees-border-color-override': 'var(--border)',
  '--trees-selected-bg-override': 'var(--accent-subtle)',
  '--trees-selected-fg-override': 'var(--text)',
  '--trees-search-bg-override': 'var(--bg-secondary)',
  '--trees-search-fg-override': 'var(--text)',
  '--trees-input-bg-override': 'var(--bg-secondary)',
} as CSSProperties;

// The tree's hover state sets a `--truncate-marker-background-overlay-color` block behind
// truncated filenames; it renders as an opaque dark slab over the row in the dark theme.
export const PIERRE_TREE_UNSAFE_CSS = `
  button[data-type='item']:hover,
  button[data-type='item'][data-item-context-hover='true'] {
    --truncate-marker-background-overlay-color: transparent;
  }
`;
