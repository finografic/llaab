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

import styles from './DeleteRunGroupAction.module.css';

export interface DeleteRunGroupActionProps {
  title: string;
  runs: RunNode[];
}

export function DeleteRunGroupAction({ title, runs }: DeleteRunGroupActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteRun = useDeleteRun();
  const preview = useDeleteRunsPreview();
  const { mutate: previewMutate, reset: previewReset } = preview;
  const [deleting, setDeleting] = useState(false);

  const runLabel = runs.length === 1 ? '1 run' : `${runs.length} runs`;
  const producedCount = runs.reduce((sum, run) => sum + run.produced_node_ids.length, 0);
  const producedLabel = producedCount === 1 ? '1 produced node' : `${producedCount} produced nodes`;

  const runIdsKey = runs.map((run) => run.id).join(',');

  useEffect(() => {
    if (!open) return;
    previewMutate(runIdsKey.split(',').filter(Boolean));
  }, [open, runIdsKey, previewMutate]);

  const close = () => {
    if (deleting) return;
    setOpen(false);
    setError(null);
    previewReset();
  };

  const confirmDelete = async () => {
    setError(null);
    setDeleting(true);

    try {
      for (const run of runs) {
        await deleteRun.mutateAsync({ id: run.id, deleteProduced: true });
      }

      toast.success(`Deleted ${runLabel}.`);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete runs.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`${styles.deleteButton} text-[var(--error-text)] opacity-60 hover:bg-[var(--error-bg)] hover:text-[var(--error-text)] hover:opacity-100`}
        aria-label={`Delete all runs for ${title}`}
        onClick={() => setOpen(true)}
      >
        <TrashIcon className={styles.deleteIcon} aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={(value) => !value && close()}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete all runs?</DialogTitle>
            <DialogDescription>
              <div className={styles.groupTitle}>{title}</div>
              This deletes {runLabel} and the {producedLabel} they produced (transcripts, ideas, etc.).{' '}
              <span className="text-red-400">This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          {preview.isPending ? (
            <p className={styles.previewLoading}>Checking what would be deleted…</p>
          ) : null}
          {preview.data ? (
            <div className={styles.preview}>
              <p>
                {preview.data.toDelete.length} node{preview.data.toDelete.length === 1 ? '' : 's'} will be
                deleted.
              </p>
              {preview.data.preserved.length > 0 ? (
                <>
                  <p>
                    {preview.data.preserved.length} node{preview.data.preserved.length === 1 ? '' : 's'} will
                    be preserved (still referenced elsewhere):
                  </p>
                  <ul className={styles.previewList}>
                    {preview.data.preserved.map((node) => (
                      <li key={node.id}>
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
            <Button type="button" variant="outline" disabled={deleting} onClick={close}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Deleting…' : `Delete ${runLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
