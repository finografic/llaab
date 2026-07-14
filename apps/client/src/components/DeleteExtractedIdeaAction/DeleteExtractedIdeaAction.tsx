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
import { useDeleteVaultNode } from 'queries/vault';
import { useState } from 'react';
import { toast } from 'sonner';
import type { IdeaNode } from '@llaab/schemas';

import styles from './DeleteExtractedIdeaAction.module.css';

export interface DeleteExtractedIdeaActionProps {
  idea: IdeaNode;
  onDeleted?: (id: string) => void;
}

export function DeleteExtractedIdeaAction({ idea, onDeleted }: DeleteExtractedIdeaActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteNode = useDeleteVaultNode();
  const deleting = deleteNode.isPending;

  function closeDialog() {
    if (deleting) return;
    setOpen(false);
    setError(null);
  }

  async function performDelete() {
    setError(null);
    try {
      const result = await deleteNode.mutateAsync(idea.id);
      const scrubbedCount = result.scrubbedReferences.length;
      toast.success(
        scrubbedCount > 0
          ? `Deleted idea and cleaned ${scrubbedCount} reference${scrubbedCount === 1 ? '' : 's'}.`
          : 'Extracted idea deleted.',
      );
      onDeleted?.(idea.id);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete extracted idea.';
      setError(message);
      toast.error(message);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`${styles.deleteButton} text-(--dim-text) opacity-30 hover:bg-(--error-bg) hover:text-(--error-text) hover:opacity-100`}
        aria-label={`Delete extracted idea ${idea.title}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <TrashIcon className={styles.deleteIcon} aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent showCloseButton={!deleting} onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete extracted idea?</DialogTitle>
            <DialogDescription>
              <div className={styles.ideaTitle}>{idea.title}</div>
              Removes this idea markdown node and scrubs references from the transcript, extraction runs, and
              any canonical ideas that listed it as a source. Existing canonical ideas are kept as-is.
              <span className="text-red-400"> This action cannot be undone.</span>
            </DialogDescription>
          </DialogHeader>

          {error ? <p className={styles.error}>{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void performDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete idea'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
