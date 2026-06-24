import { GitCommitVerticalIcon, LoaderIcon, XIcon } from '@llaab/icons';
import { FileTree, useFileTree } from '@pierre/trees/react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'components/ui/alert-dialog';
import { Button } from 'components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useVaultGitCommit, useVaultGitReset, useVaultGitStatus } from 'queries/vault';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { VaultGitStatusEntry } from '@llaab/schemas';
import type { GitStatusEntry } from '@pierre/trees';

import { PIERRE_TREE_THEME_STYLE, PIERRE_TREE_UNSAFE_CSS } from 'lib/pierre-trees-theme';

import styles from './VaultGitPanel.module.css';

const EMPTY_GIT_ENTRIES: VaultGitStatusEntry[] = [];

function pluralizeFiles(count: number): string {
  return `${count} file${count === 1 ? '' : 's'}`;
}

function VaultGitFileTree({ entries }: { entries: VaultGitStatusEntry[] }) {
  const paths = useMemo(() => entries.map((entry) => entry.path), [entries]);
  const gitStatus = useMemo<GitStatusEntry[]>(
    () => entries.map((entry) => ({ path: entry.path, status: entry.status })),
    [entries],
  );
  const { model } = useFileTree({
    paths,
    gitStatus,
    initialExpansion: 'open',
    unsafeCSS: PIERRE_TREE_UNSAFE_CSS,
  });

  return <FileTree model={model} style={PIERRE_TREE_THEME_STYLE} />;
}

export function VaultGitPanel({ onClose }: { onClose: () => void }) {
  const { data, error, isLoading } = useVaultGitStatus();
  const commitMutation = useVaultGitCommit();
  const resetMutation = useVaultGitReset();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const treeSignature = useMemo(
    () => data?.entries.map((entry) => `${entry.status}:${entry.path}`).join('\n') ?? '',
    [data],
  );

  const handleCommit = async () => {
    try {
      const result = await commitMutation.mutateAsync();
      toast.success(`Committed ${pluralizeFiles(result.committedCount)}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Vault commit failed.');
    }
  };

  const handleReset = async () => {
    try {
      const result = await resetMutation.mutateAsync();
      toast.success(`Reset ${pluralizeFiles(result.resetCount)}.`);
      setShowResetConfirm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Vault reset failed.');
    }
  };

  const hasChanges = (data?.totalCount ?? 0) > 0;
  // Display-only: the real commitMessage (used for the actual `git commit -m`) keeps the blank
  // line between subject and body since commitlint's body-leading-blank rule requires it.
  const displayCommitMessage = data?.commitMessage.replace('\n\n', '\n');

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
            <pre className={styles.commitMessage}>{displayCommitMessage}</pre>
            <div className={styles.treeWrap}>
              <VaultGitFileTree key={treeSignature} entries={data?.entries ?? EMPTY_GIT_ENTRIES} />
            </div>
          </>
        ) : null}
      </div>

      {hasChanges ? (
        <footer className={styles.footer}>
          <Button
            type="button"
            variant="outline"
            className={styles.resetButton}
            disabled={resetMutation.isPending}
            onClick={() => setShowResetConfirm(true)}
          >
            <RotateCcw aria-hidden />
            Reset
          </Button>
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

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset vault changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently discards all uncommitted changes under vault/ — both modified tracked files and new
              untracked files — on disk and in this panel. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleReset();
              }}
            >
              {resetMutation.isPending ? 'Resetting…' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
