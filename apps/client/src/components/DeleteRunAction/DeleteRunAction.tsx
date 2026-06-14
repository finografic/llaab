import { TrashIcon } from '@llaab/icons';
import { Button } from 'components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'components/ui/dialog';
import { useDeleteRun, useDeleteRunsPreview } from 'queries/runs';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { RunNode } from '@llaab/schemas';

import styles from './DeleteRunAction.module.css';

type DialogStep = 'closed' | 'confirm-run' | 'confirm-produced';

export interface DeleteRunActionProps {
  run: RunNode;
  onDeleted?: (runId: string) => void;
  color?: 'dim' | 'error';
}

export function DeleteRunAction({ run, onDeleted, color = 'error' }: DeleteRunActionProps) {
  const [step, setStep] = useState<DialogStep>('closed');
  const [error, setError] = useState<string | null>(null);
  const deleteRun = useDeleteRun();
  const preview = useDeleteRunsPreview();
  const { mutate: previewMutate, reset: previewReset } = preview;
  const deleting = deleteRun.isPending;

  const producedCount = run.produced_node_ids.length;
  const producedLabel = producedCount === 1 ? '1 node' : `${producedCount} nodes`;

  useEffect(() => {
    if (step !== 'confirm-produced') return;
    previewMutate([run.id]);
  }, [step, run.id, previewMutate]);

  const closeDialogs = () => {
    if (deleting) return;
    setStep('closed');
    setError(null);
    previewReset();
  };

  const performDelete = async (deleteProduced: boolean) => {
    setError(null);

    try {
      const { deletedProduced } = await deleteRun.mutateAsync({ id: run.id, deleteProduced });

      toast.success(
        deletedProduced > 0
          ? `Run deleted with ${deletedProduced} produced node${deletedProduced === 1 ? '' : 's'}.`
          : 'Run deleted.',
      );

      onDeleted?.(run.id);
      setStep('closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run.');
    }
  };

  const confirmRunDelete = () => {
    if (producedCount > 0) {
      setStep('confirm-produced');
      return;
    }

    void performDelete(false);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`${styles.deleteButton} text-[var(--${color}-text)] ${color === 'dim' ? 'opacity-30' : 'opacity-60'} hover:bg-[var(--${color}-bg)] hover:text-[var(--error-text)] hover:opacity-100`}
        aria-label={`Delete run ${run.title}`}
        onClick={() => setStep('confirm-run')}
      >
        <TrashIcon className={styles.deleteIcon} aria-hidden />
      </Button>

      <Dialog open={step === 'confirm-run'} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete run?</DialogTitle>
            <DialogDescription>
              <div className={styles.runTitle}>{run.title}</div>
              <span className="text-red-400">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          {error && <p className={styles.error}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={closeDialogs}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmRunDelete}>
              {deleting ? 'Deleting…' : 'Delete run'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 'confirm-produced'} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete produced nodes too?</DialogTitle>
            <DialogDescription>
              This run produced {producedLabel}. You can delete the run only, or remove the run and those
              nodes from the vault.
            </DialogDescription>
          </DialogHeader>

          {producedCount > 0 && !preview.data && (
            <ul className={styles.producedList}>
              {run.produced_node_ids.map((nodeId) => (
                <li key={nodeId} className={styles.producedItem}>
                  {nodeId}
                </li>
              ))}
            </ul>
          )}

          {preview.isPending ? (
            <p className={styles.previewLoading}>Checking what would be deleted…</p>
          ) : null}
          {preview.data ? (
            <div className={styles.preview}>
              <p>
                {preview.data.toDelete.length} node{preview.data.toDelete.length === 1 ? '' : 's'} would be
                deleted with "Run and nodes".
              </p>
              {preview.data.preserved.length > 0 ? (
                <>
                  <p>
                    {preview.data.preserved.length} node{preview.data.preserved.length === 1 ? '' : 's'} would
                    be preserved (still referenced elsewhere):
                  </p>
                  <ul className={styles.producedList}>
                    {preview.data.preserved.map((node) => (
                      <li key={node.id} className={styles.producedItem}>
                        {node.title} — {node.reason}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {preview.data.canonicalIdeasAffected.length > 0 ? (
                <p>
                  {preview.data.canonicalIdeasAffected.length} canonical idea
                  {preview.data.canonicalIdeasAffected.length === 1 ? '' : 's'} reference these nodes and will
                  remain.
                </p>
              ) : null}
            </div>
          ) : null}

          {error && <p className={styles.error}>{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={closeDialogs}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => void performDelete(false)}
            >
              {deleting ? 'Deleting…' : 'Run only'}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void performDelete(true)}
            >
              {deleting ? 'Deleting…' : 'Run and nodes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
