import { Button } from 'components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from 'components/ui/dialog';
import { ArchiveIcon, LoaderCircleIcon } from 'lucide-react';
import { useDemoteKnowledgeWiki } from 'queries/knowledge';
import { useState } from 'react';
import { toast } from 'sonner';
import type { KnowledgeWikiPage } from '@llaab/schemas';

export interface DemoteKnowledgeWikiActionProps {
  wiki: KnowledgeWikiPage;
  onDemoted?: (wikiId: string) => void;
}

export function DemoteKnowledgeWikiAction({ wiki, onDemoted }: DemoteKnowledgeWikiActionProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoteWiki = useDemoteKnowledgeWiki();
  const demoting = demoteWiki.isPending;

  const closeDialog = () => {
    if (demoting) return;
    setOpen(false);
    setError(null);
  };

  const performDemote = async () => {
    setError(null);
    try {
      const result = await demoteWiki.mutateAsync(wiki.id);
      const retained = result.retainedDraftIds.length;
      toast.success(
        retained > 0
          ? `Wiki unpublished. ${retained} draft lineage record${retained === 1 ? '' : 's'} retained.`
          : 'Wiki unpublished from canonical knowledge.',
      );
      onDemoted?.(wiki.id);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unpublish wiki.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <ArchiveIcon aria-hidden />
        Unpublish
      </Button>

      <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
        <DialogContent showCloseButton={!demoting} onClick={(event) => event.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Unpublish wiki?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{wiki.title}</span>
              {' — '}
              Removes this page from canonical knowledge and scrubs inbound wiki links. Vault drafts and
              source lineage remain for audit and supported section regeneration. This is a post-creation
              correction, not part of normal creation.
            </DialogDescription>
          </DialogHeader>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={demoting} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="button" disabled={demoting} onClick={() => void performDemote()}>
              {demoting ? <LoaderCircleIcon className="animate-spin" /> : <ArchiveIcon />}
              {demoting ? 'Unpublishing…' : 'Unpublish wiki'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
