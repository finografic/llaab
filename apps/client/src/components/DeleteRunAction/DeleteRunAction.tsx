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
import { useState } from 'react';
import { toast } from 'sonner';
import type { RunNode } from '@llaab/schemas';

import { deleteVaultRun } from 'lib/api';

import s from './DeleteRunAction.module.css';

type DialogStep = 'closed' | 'confirm-run' | 'confirm-produced';

export interface DeleteRunActionProps {
  run: RunNode;
  onDeleted: (runId: string) => void;
}

export function DeleteRunAction({ run, onDeleted }: DeleteRunActionProps) {
  const [step, setStep] = useState<DialogStep>('closed');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const producedCount = run.produced_node_ids.length;
  const producedLabel = producedCount === 1 ? '1 node' : `${producedCount} nodes`;

  const closeDialogs = () => {
    if (deleting) return;
    setStep('closed');
    setError(null);
  };

  const performDelete = async (deleteProduced: boolean) => {
    setDeleting(true);
    setError(null);

    try {
      const res = await deleteVaultRun(run.id, deleteProduced);

      const body = (await res.json().catch(() => null)) as {
        error?: string;
        deletedProduced?: number;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to delete run.');
      }

      const deletedProduced = body?.deletedProduced ?? 0;

      toast.success(
        deletedProduced > 0
          ? `Run deleted with ${deletedProduced} produced node${deletedProduced === 1 ? '' : 's'}.`
          : 'Run deleted.',
      );

      onDeleted(run.id);
      setStep('closed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run.');
    } finally {
      setDeleting(false);
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
        className={`${s.deleteButton} text-[var(--error-text)] opacity-60 hover:bg-[var(--error-bg)] hover:text-[var(--error-text)] hover:opacity-100`}
        aria-label={`Delete run ${run.title}`}
        onClick={() => setStep('confirm-run')}
      >
        <TrashIcon className={s.deleteIcon} aria-hidden />
      </Button>

      <Dialog open={step === 'confirm-run'} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete run?</DialogTitle>
            <DialogDescription>
              This removes the run record for <span className={s.runTitle}>{run.title}</span>. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && <p className={s.error}>{error}</p>}

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

          {producedCount > 0 && (
            <ul className={s.producedList}>
              {run.produced_node_ids.map((nodeId) => (
                <li key={nodeId} className={s.producedItem}>
                  {nodeId}
                </li>
              ))}
            </ul>
          )}

          {error && <p className={s.error}>{error}</p>}

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
