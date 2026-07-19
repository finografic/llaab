import { Alert, AlertDescription, AlertTitle } from 'components/ui/alert';
import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
import { Col, Row } from 'components/ui/grid';
import { FilePenLineIcon, LoaderCircleIcon, XIcon } from 'lucide-react';
import { useRunMonitor } from 'queries/runs';
import { useCreateWikiDraft } from 'queries/transcripts';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import { formatElapsed, heartbeatStore, useElapsedMs } from 'lib/heartbeat';

import styles from './WikiDraftComposer.module.css';

interface WikiDraftComposerProps {
  transcriptId: string;
  canonicalIdeas: CanonicalIdeaNode[];
}

interface DraftCreationAlert {
  status: 'success' | 'error';
  message: string;
}

function ideaIdsKey(ideas: CanonicalIdeaNode[]): string {
  return ideas.map((idea) => idea.id).join('\0');
}

export function WikiDraftComposer({ transcriptId, canonicalIdeas }: WikiDraftComposerProps) {
  const createDraft = useCreateWikiDraft();
  const navigate = useNavigate();
  const { data: monitor } = useRunMonitor();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(canonicalIdeas.map((idea) => idea.id)),
  );
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [creationAlert, setCreationAlert] = useState<DraftCreationAlert | null>(null);
  const canonicalIdsKey = useMemo(() => ideaIdsKey(canonicalIdeas), [canonicalIdeas]);
  const activeRun = useMemo(
    () =>
      monitor?.active.find(
        (run) => run.skill_id === 'compile-wiki-draft' && run.raw_input_summary?.includes(transcriptId),
      ),
    [monitor, transcriptId],
  );
  const busy = createDraft.isPending || activeRun != null;
  const activeRunStartedAt = activeRun?.started_at ? Date.parse(activeRun.started_at) : null;
  const elapsedMs = useElapsedMs(startedAt ?? activeRunStartedAt);

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
      setCreationAlert({ status: 'error', message: 'Select at least one canonical idea.' });
      return;
    }
    setCreationAlert(null);
    setStartedAt(heartbeatStore.getState().now);
    try {
      const result = await createDraft.mutateAsync({
        transcriptId,
        canonicalIdeaIds: [...selectedIds],
      });
      setCreationAlert({
        status: 'success',
        message: result.wikiCount === 1 ? 'Wiki created.' : `${result.wikiCount} focused wikis created.`,
      });
      navigate(`/knowledge/wikis/${result.wikiId}`, {
        state: { generatedWikis: result.wikis },
      });
    } catch (error) {
      setCreationAlert({
        status: 'error',
        message: error instanceof Error ? error.message : 'Wiki compilation failed.',
      });
    } finally {
      setStartedAt(null);
    }
  }

  return (
    <Row className="mt-3 rounded-md border border-border p-3">
      <Col>
        <p className="text-sm font-semibold">Create wiki</p>
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
          The model will choose titles and topic ids. Broad selections may create multiple focused wikis.
        </p>
      </Col>
      <Col>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          ) : (
            <FilePenLineIcon aria-hidden="true" />
          )}
          {busy ? `Creating… ${formatElapsed(Math.max(0, Math.floor(elapsedMs / 1000)))}` : 'Create Wiki'}
        </Button>
      </Col>
      {creationAlert ? (
        <Col>
          <Alert
            variant={creationAlert.status === 'error' ? 'destructive' : 'default'}
            className={
              creationAlert.status === 'success' ? 'relative border-emerald-500/40 pr-10' : 'relative pr-10'
            }
          >
            <AlertTitle>
              {creationAlert.status === 'success' ? 'Wiki created' : 'Wiki creation failed'}
            </AlertTitle>
            <AlertDescription>{creationAlert.message}</AlertDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2"
              aria-label="Dismiss wiki creation result"
              onClick={() => setCreationAlert(null)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </Alert>
        </Col>
      ) : null}
    </Row>
  );
}
