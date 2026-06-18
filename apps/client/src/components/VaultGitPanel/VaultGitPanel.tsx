import { GitCommitVerticalIcon, LoaderIcon, XIcon } from '@llaab/icons';
import { FileTree, useFileTree } from '@pierre/trees/react';
import { Button } from 'components/ui/button';
import { useVaultGitCommit, useVaultGitStatus } from 'queries/vault';
import { useMemo } from 'react';
import { toast } from 'sonner';
import type { GitStatusEntry } from '@pierre/trees';
import type { CSSProperties } from 'react';

import styles from './VaultGitPanel.module.css';

// `@pierre/trees` ships its own light-mode default theme; override via its documented
// CSS custom properties to match the app's dark theme tokens instead of forking its CSS.
const TREE_THEME_STYLE = {
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

function pluralizeFiles(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`;
}

export function VaultGitPanel({ onClose }: { onClose: () => void }) {
  const { data, error, isLoading } = useVaultGitStatus();
  const commitMutation = useVaultGitCommit();

  const paths = useMemo(() => data?.entries.map((entry) => entry.path) ?? [], [data]);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => data?.entries.map((entry) => ({ path: entry.path, status: entry.status })) ?? [],
    [data],
  );
  const { model } = useFileTree({ paths, gitStatus, initialExpansion: 'open' });

  const handleCommit = async () => {
    try {
      const result = await commitMutation.mutateAsync();
      toast.success(`Committed ${pluralizeFiles(result.committedCount)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Vault commit failed.');
    }
  };

  const hasChanges = (data?.totalCount ?? 0) > 0;

  return (
    <aside className={styles.panel} aria-label="Vault changes">
      <header className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Vault Changes</h2>
          <p className={styles.panelDescription}>Uncommitted files under vault/, grouped by node type.</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close vault changes"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </header>

      <div className={styles.body}>
        {error instanceof Error ? <p className={styles.error}>{error.message}</p> : null}
        {isLoading ? <p className={styles.empty}>Loading vault status...</p> : null}
        {!isLoading && !hasChanges ? <p className={styles.empty}>No vault changes.</p> : null}

        {hasChanges ? (
          <>
            <pre className={styles.commitMessage}>{data?.commitMessage}</pre>
            <div className={styles.treeWrap}>
              <FileTree model={model} style={TREE_THEME_STYLE} />
            </div>
          </>
        ) : null}
      </div>

      {hasChanges ? (
        <footer className={styles.footer}>
          <Button type="button" disabled={commitMutation.isPending} onClick={handleCommit}>
            {commitMutation.isPending ? (
              <LoaderIcon className="animate-spin" aria-hidden />
            ) : (
              <GitCommitVerticalIcon aria-hidden />
            )}
            {commitMutation.isPending ? 'Committing…' : `Commit ${pluralizeFiles(data?.totalCount ?? 0)}`}
          </Button>
        </footer>
      ) : null}
    </aside>
  );
}

export function VaultGitTrigger({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) {
  const { data } = useVaultGitStatus();
  const count = data?.totalCount ?? 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={styles.trigger}
      onClick={onToggle}
      aria-pressed={isActive}
      aria-label={count > 0 ? `Toggle vault changes, ${count} changed files` : 'Toggle vault changes'}
    >
      <GitCommitVerticalIcon aria-hidden />
      {count > 0 ? <span className={styles.triggerBadge}>{count}</span> : null}
    </Button>
  );
}
