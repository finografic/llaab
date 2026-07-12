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
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { EyeIcon } from 'lucide-react';
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
      {reviewState === 'new' || reviewState === 'failed' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          title="Keep in Vault and remove from Needs attention"
          disabled={updateNode.isPending}
          onClick={() =>
            void applyReviewState(
              'reviewed',
              'Marked reviewed — kept in Vault and available under All or Reviewed.',
            )
          }
        >
          <EyeIcon aria-hidden />
          Mark reviewed
        </Button>
      ) : reviewState === 'reviewed' ? (
        <Badge variant="outline" className={styles.reviewedBadge}>
          <EyeIcon aria-hidden />
          Reviewed · kept in Vault
        </Badge>
      ) : null}
      {reviewState === 'archived' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={updateNode.isPending}
          onClick={() => void applyReviewState('reviewed', 'Unarchived — returned to Reviewed in Vault.')}
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
              Archiving is separate from reviewing. It removes the capture from active attention views, but
              keeps the vault node. It does not promote anything into knowledge, and you can retrieve it using
              Review: archived.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateNode.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateNode.isPending}
              onClick={() => {
                void applyReviewState('archived', 'Archived — kept in Vault and not promoted.').then(() => {
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
