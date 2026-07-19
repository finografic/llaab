import { Button } from 'components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'components/ui/dialog';
import { LoaderCircleIcon, Trash2Icon } from 'lucide-react';
import { useDeleteKnowledgeWiki } from 'queries/knowledge';
import { useState } from 'react';
import { toast } from 'sonner';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import styles from './DeleteKnowledgeWikiAction.module.css';

export interface DeleteKnowledgeWikiActionProps {
  wiki: KnowledgeWikiPage;
  onDeleted?: (wikiId: string) => void;
  variant?: 'button' | 'icon';
}

export function DeleteKnowledgeWikiAction({
  wiki,
  onDeleted,
  variant = 'icon',
}: DeleteKnowledgeWikiActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteWiki = useDeleteKnowledgeWiki();
  const deleting = deleteWiki.isPending;

  const closeDialog = () => {
    if (deleting) return;
    setOpen(false);
    setError(null);
  };

  const performDelete = async () => {
    setError(null);
    try {
      const result = await deleteWiki.mutateAsync(wiki.id);
      const scrubbedCount = result.scrubbedReferences.length;
      toast.success(
        scrubbedCount > 0
          ? `Wiki deleted and ${scrubbedCount} inbound reference${scrubbedCount === 1 ? '' : 's'} cleaned.`
          : 'Wiki deleted.',
      );
      onDeleted?.(wiki.id);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete wiki.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant === 'button' ? 'destructive' : 'ghost'}
        size={variant === 'button' ? 'default' : 'icon-sm'}
        className={variant === 'icon' ? styles.deleteButton : undefined}
        aria-label={`Delete wiki ${wiki.title}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2Icon aria-hidden />
        {variant === 'button' ? 'Delete wiki' : null}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent showCloseButton={!deleting} onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete wiki?</DialogTitle>
            <DialogDescription>
              <span className={styles.wikiTitle}>{wiki.title}</span>
              This removes the promoted Markdown file and scrubs inbound links from other promoted wikis.
              Transcript evidence, canonical ideas, and historical drafts remain in the vault.
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
              {deleting ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />}
              {deleting ? 'Deleting…' : 'Delete wiki'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
