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
import { useUpdateVaultNode } from 'queries/vault';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { getInboxReviewState, withInboxReviewState } from 'lib/inbox-review.utils';
import type { InboxReviewState } from 'lib/inbox-review.utils';

import styles from './InboxCaptureActions.module.css';

export interface InboxCaptureActionsProps {
  capture: ParsedInboxCapture;
}

export function InboxCaptureActions({ capture }: InboxCaptureActionsProps) {
  const updateNode = useUpdateVaultNode();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const reviewState = getInboxReviewState(capture.node);
  const url =
    typeof capture.provenance?.payload?.['url'] === 'string' ? capture.provenance.payload['url'] : undefined;

  const applyReviewState = async (state: InboxReviewState, successMessage: string) => {
    try {
      await updateNode.mutateAsync({
        id: capture.node.id,
        tags: withInboxReviewState(capture.node.tags, state),
      });
      toast.success(successMessage);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update capture.');
    }
  };

  return (
    <div className={styles.actions}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={updateNode.isPending || reviewState === 'reviewed'}
        onClick={() => void applyReviewState('reviewed', 'Marked as reviewed')}
      >
        Mark reviewed
      </Button>
      {reviewState === 'archived' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateNode.isPending}
          onClick={() => void applyReviewState('reviewed', 'Unarchived capture')}
        >
          Unarchive
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateNode.isPending}
          onClick={() => setConfirmArchive(true)}
        >
          Archive
        </Button>
      )}
      <Button asChild size="sm" variant="ghost">
        <Link to={`/vault/nodes/${capture.node.id}`}>Open target node</Link>
      </Button>
      {url ? (
        <Button asChild size="sm" variant="ghost">
          <a href={url} target="_blank" rel="noreferrer">
            Open source
          </a>
        </Button>
      ) : null}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this capture?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving clears it from the default inbox attention list. The vault node is kept; you can
              unarchive later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateNode.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateNode.isPending}
              onClick={() => {
                void applyReviewState('archived', 'Archived capture').then(() => {
                  setConfirmArchive(false);
                  return undefined;
                });
              }}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
