import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
import { Col, Row } from 'components/ui/grid';
import { FilePenLineIcon } from 'lucide-react';
import { useRunMonitor } from 'queries/runs';
import { useCreateWikiDraft } from 'queries/transcripts';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import styles from './WikiDraftComposer.module.css';

interface WikiDraftComposerProps {
  transcriptId: string;
  canonicalIdeas: CanonicalIdeaNode[];
}

function ideaIdsKey(ideas: CanonicalIdeaNode[]): string {
  return ideas.map((idea) => idea.id).join('\0');
}

export function WikiDraftComposer({ transcriptId, canonicalIdeas }: WikiDraftComposerProps) {
  const navigate = useNavigate();
  const createDraft = useCreateWikiDraft();
  const { data: monitor } = useRunMonitor();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(canonicalIdeas.map((idea) => idea.id)),
  );
  const canonicalIdsKey = useMemo(() => ideaIdsKey(canonicalIdeas), [canonicalIdeas]);
  const activeRun = useMemo(
    () =>
      monitor?.active.find(
        (run) => run.skill_id === 'compile-wiki-draft' && run.raw_input_summary?.includes(transcriptId),
      ),
    [monitor, transcriptId],
  );
  const busy = createDraft.isPending || activeRun != null;

  // useState only seeds on mount; after consolidation, ideas arrive while this composer is
  // already mounted (often with an empty initial set). Reselect whenever the id set changes.
  useEffect(() => {
    setSelectedIds(new Set(canonicalIdsKey === '' ? [] : canonicalIdsKey.split('\0')));
  }, [canonicalIdsKey]);

  if (canonicalIdeas.length === 0) return null;

  function toggleIdea(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function submit() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one canonical idea.');
      return;
    }
    try {
      const result = await createDraft.mutateAsync({
        transcriptId,
        canonicalIdeaIds: [...selectedIds],
      });
      toast.success('Wiki draft created.');
      navigate(`/vault/wiki-drafts/${result.draftId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wiki compilation failed.');
    }
  }

  return (
    <Row className="mt-3 rounded-md border border-border p-3">
      <Col>
        <p className="text-sm font-semibold">Create wiki draft</p>
        <p className="text-xs text-muted-foreground">Choose the canonical ideas to synthesize.</p>
      </Col>
      <Col>
        {canonicalIdeas.map((idea) => (
          <label key={idea.id} className="flex cursor-pointer items-start gap-2 py-1 text-sm">
            <Checkbox
              className={styles.consolidationCheckbox}
              checked={selectedIds.has(idea.id)}
              onCheckedChange={(checked) => toggleIdea(idea.id, checked === true)}
            />
            <span>{idea.title}</span>
          </label>
        ))}
      </Col>
      <Col>
        <p className="text-xs text-muted-foreground">
          The model will choose the draft title and topic id. You can edit the draft title after creation.
        </p>
      </Col>
      <Col>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void submit()}>
          <FilePenLineIcon aria-hidden="true" />
          {busy ? 'Creating wiki draft…' : 'Create Wiki Draft'}
        </Button>
      </Col>
    </Row>
  );
}
