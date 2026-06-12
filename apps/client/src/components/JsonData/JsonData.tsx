// import { JsonViewer } from 'components/ui/elements/json-viewer';
import { Label } from 'components/ui/label';
import { Switch } from 'components/ui/switch';
import { useEffect, useId, useMemo, useState } from 'react';
import { JSONTree } from 'react-json-tree';
import type { ReactNode } from 'react';
// import type { JsonValue } from 'components/ui/elements/json-viewer';

import { formatMetadataJson, parseMetadataJson } from 'utils/metadata-rendering.utils';

import styles from './JsonData.module.css';

type JsonDataKey = string | number;

export interface JsonDataLinkRule {
  /** Match a JSON property name, e.g. `sourceId` or `id`. */
  key?: string;
  /** Match array values under a parent property, e.g. `producedNodeIds`. */
  parentKey?: string;
  /** Route template. `:value` is replaced with the current primitive value. */
  href: string;
  /** Optional sibling guard on the parent object, e.g. `{ key: 'type', equals: 'transcript' }`. */
  when?: {
    key: string;
    equals: string | number | boolean;
  };
}

interface JsonDataLinkContext {
  key: JsonDataKey | undefined;
  parentKey: JsonDataKey | undefined;
  parent: unknown;
}

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

const EMPTY_LINK_RULES: JsonDataLinkRule[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readParent(root: unknown, keyPath: readonly JsonDataKey[]): unknown {
  let cursor = root;

  for (let index = keyPath.length - 1; index >= 1; index--) {
    const segment = keyPath[index];
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<JsonDataKey, unknown>)[segment];
  }

  return cursor;
}

function getLinkContext(root: unknown, keyPath: readonly JsonDataKey[]): JsonDataLinkContext {
  return {
    key: keyPath[0],
    parentKey: keyPath[1],
    parent: readParent(root, keyPath),
  };
}

function ruleMatches(rule: JsonDataLinkRule, context: JsonDataLinkContext): boolean {
  if (rule.key !== undefined && rule.key !== context.key) return false;
  if (rule.parentKey !== undefined && rule.parentKey !== context.parentKey) return false;
  if (!rule.when) return true;
  if (!context.parent || typeof context.parent !== 'object') return false;

  return (context.parent as Record<string, unknown>)[rule.when.key] === rule.when.equals;
}

function getRuleHref(
  value: unknown,
  keyPath: readonly JsonDataKey[],
  root: unknown,
  linkRules: JsonDataLinkRule[],
): string | undefined {
  if (!['string', 'number'].includes(typeof value)) return undefined;

  const context = getLinkContext(root, keyPath);
  const rule = linkRules.find((candidate) => ruleMatches(candidate, context));
  if (!rule) return undefined;

  return rule.href.replace(':value', encodeURIComponent(String(value)));
}

/** Hotlinks string values that are entirely a URL — same look, but clickable. */
function renderLinkedValue(valueAsString: unknown, href: string, external = false): ReactNode {
  const rendered = valueAsString as ReactNode;
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className={styles.link}
    >
      {rendered}
    </a>
  );
}

function createJsonValueRenderer(root: unknown, linkRules: JsonDataLinkRule[]) {
  return function jsonValueRenderer(
    valueAsString: unknown,
    value: unknown,
    ...keyPath: JsonDataKey[]
  ): ReactNode {
    const internalHref = getRuleHref(value, keyPath, root, linkRules);
    if (internalHref) return renderLinkedValue(valueAsString, internalHref);

    if (typeof value === 'string' && /^https?:\/\/\S+$/.test(value)) {
      return renderLinkedValue(valueAsString, value, true);
    }

    return valueAsString as ReactNode;
  };
}

function jsonItemStringRenderer(
  _type: unknown,
  _data: unknown,
  itemType: ReactNode,
  itemString: ReactNode,
): ReactNode {
  return (
    <span className={styles.itemString}>
      {itemType} {itemString}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface JsonDataProps {
  /** JSON string to display — may contain literal escaped quotes (`\"`). */
  value: string;
  /** Label shown beside the toggle switch. Defaults to `'Raw'`. */
  label?: string;
  /** Optional internal-link rules for known JSON keys. */
  linkRules?: JsonDataLinkRule[];
}

/**
 * Renders a JSON string with a raw/formatted toggle — used for `input_summary` /
 * `output_summary` on run detail pages, and any other stored JSON-as-string field.
 *
 * Defaults to formatted mode. Toggling raw on shows the normalized JSON string
 * with line breaks. Formatted mode renders a foldable, syntax-coloured tree via
 * `react-json-tree`.
 */
export function JsonData({ value, label = 'Raw', linkRules = EMPTY_LINK_RULES }: JsonDataProps) {
  const switchId = useId();
  const [raw, setRaw] = useState(false);
  const [mounted, setMounted] = useState(false);

  const rawDisplay = useMemo(() => formatMetadataJson(value, 2), [value]);
  const parsed = useMemo(() => parseMetadataJson(value), [value]);
  const valueRenderer = useMemo(() => createJsonValueRenderer(parsed, linkRules), [linkRules, parsed]);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.data}>
        {mounted && !raw && parsed !== undefined ? (
          <div className={styles.tree}>
            {/* <JsonViewer data={parsed as JsonValue} searchable copyPath collapsed={1} /> */}
            <JSONTree
              data={parsed}
              theme={JSON_TREE_THEME}
              hideRoot
              valueRenderer={valueRenderer}
              getItemString={jsonItemStringRenderer}
            />
          </div>
        ) : (
          <code className={styles.raw}>{rawDisplay}</code>
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
