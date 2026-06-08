import { Label } from 'components/ui/label';
import { Switch } from 'components/ui/switch';
import { useId, useMemo, useState } from 'react';
import { JSONTree } from 'react-json-tree';
import type { ReactNode } from 'react';

import styles from './JsonData.module.css';

// ─── Theme ────────────────────────────────────────────────────────────────────

/** Base16 theme for JSONTree, mapped to LLAAB's CSS custom properties. */
const JSON_TREE_THEME = {
  scheme: 'llaab',
  author: 'llaab',
  base00: 'transparent',
  base01: 'var(--surface-raised)',
  base02: 'var(--border-subtle)',
  base03: 'var(--text-faint)',
  base04: 'var(--text-muted)',
  base05: 'var(--text)',
  base06: 'var(--text)',
  base07: 'var(--text)',
  base08: 'var(--error-text)',
  base09: 'var(--warning-text)',
  base0A: 'var(--warning-text)',
  base0B: 'var(--success-text)',
  base0C: 'var(--accent-dim)',
  base0D: 'var(--accent)',
  base0E: 'var(--accent)',
  base0F: 'var(--text-faint)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stored summaries carry literal escaped quotes (`\"`) — clean them for display. */
function cleanEscapedJson(value: string): string {
  return value.replace(/\\"/g, '"');
}

/** Hotlinks string values that are entirely a URL — same look, but clickable. */
function jsonValueRenderer(valueAsString: unknown, value: unknown): ReactNode {
  const rendered = valueAsString as ReactNode;
  if (typeof value === 'string' && /^https?:\/\/\S+$/.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {rendered}
      </a>
    );
  }
  return rendered;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JsonDataProps {
  /** JSON string to display — may contain literal escaped quotes (`\"`). */
  value: string;
  /** Label shown beside the toggle switch. Defaults to `'Raw'`. */
  label?: string;
}

/**
 * Renders a JSON string with a raw/formatted toggle — used for `input_summary` /
 * `output_summary` on run detail pages, and any other stored JSON-as-string field.
 *
 * Defaults to raw mode: the cleaned string shown inline (no prettifying). Toggling
 * off parses it and renders a foldable, syntax-coloured, monospaced tree via
 * `react-json-tree`.
 */
export function JsonData({ value, label = 'Raw' }: JsonDataProps) {
  const switchId = useId();
  const [raw, setRaw] = useState(true);

  const cleaned = useMemo(() => cleanEscapedJson(value), [value]);
  const parsed = useMemo<unknown>(() => {
    if (raw) return undefined;
    try {
      return JSON.parse(cleaned);
    } catch {
      return undefined;
    }
  }, [cleaned, raw]);

  return (
    <div className={styles.root}>
      <div className={styles.data}>
        {!raw && parsed !== undefined ? (
          <div className={styles.tree}>
            <JSONTree
              data={parsed}
              theme={JSON_TREE_THEME}
              hideRoot
              valueRenderer={jsonValueRenderer}
              getItemString={(_type, _data, itemType, itemString) => (
                <span className={styles.itemString}>
                  {itemType} {itemString}
                </span>
              )}
            />
          </div>
        ) : (
          <code className={styles.raw}>{cleaned}</code>
        )}
      </div>

      <div className={styles.toggle}>
        <Switch id={switchId} size="sm" checked={raw} onCheckedChange={setRaw} />
        <Label htmlFor={switchId} className={styles.toggleLabel}>
          {label}
        </Label>
      </div>
    </div>
  );
}
