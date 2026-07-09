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

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';

import styles from './DeleteInboxCaptureAction.module.css';

export interface DeleteInboxCaptureActionProps {
  capture: ParsedInboxCapture;
  onDeleted?: (id: string) => void;
  color?: 'dim' | 'error';
}

export function DeleteInboxCaptureAction({
  capture,
  onDeleted,
  color = 'dim',
}: DeleteInboxCaptureActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteNode = useDeleteVaultNode();
  const deleting = deleteNode.isPending;
  const { node } = capture;

  const closeDialog = () => {
    if (deleting) return;
    setOpen(false);
    setError(null);
  };

  const performDelete = async () => {
    setError(null);
    try {
      const result = await deleteNode.mutateAsync(node.id);
      const scrubbedCount = result.scrubbedReferences.length;
      toast.success(
        scrubbedCount > 0
          ? `Deleted capture and cleaned ${scrubbedCount} reference${scrubbedCount === 1 ? '' : 's'}.`
          : 'Inbox capture deleted.',
      );
      onDeleted?.(node.id);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete inbox capture.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`${styles.deleteButton} text-[var(--${color}-text)] ${color === 'dim' ? 'opacity-30' : 'opacity-60'} hover:bg-[var(--${color}-bg)] hover:text-[var(--error-text)] hover:opacity-100`}
        aria-label={`Delete inbox capture ${node.title}`}
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
            <DialogTitle>Delete inbox capture?</DialogTitle>
            <DialogDescription>
              <div className={styles.captureTitle}>{node.title}</div>
              Removes this Hermes capture from the vault and scrubs inbound related/tag/body references.
              Promoted resources are kept unless they only exist as dangling links.
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
              {deleting ? 'Deleting…' : 'Delete capture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
