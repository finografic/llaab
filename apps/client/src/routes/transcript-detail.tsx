import { TranscriptsSplitView } from 'components/TranscriptsSplitView/TranscriptsSplitView';
import { useVaultNode, useVaultNodes } from 'queries/vault';
import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { IdeaNode, RunNode, TranscriptNode } from '@llaab/schemas';
import type { TranscriptExtractionRun } from 'components/TranscriptsSplitView/components/TranscriptDetail';

import { usePageTitle } from 'lib/use-page-title';

export function TranscriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: transcriptNode, isLoading: transcriptLoading } = useVaultNode(id);
  const { data: allTranscripts = [], isLoading: listLoading } = useVaultNodes({ type: 'transcript' });
  const { data: ideaNodes = [] } = useVaultNodes({ type: 'idea' });
  const { data: runNodes = [] } = useVaultNodes({ type: 'run' });

  const transcripts = useMemo(
    () =>
      [...(allTranscripts as TranscriptNode[])].toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [allTranscripts],
  );

  const transcript: TranscriptNode | undefined =
    transcriptNode?.type === 'transcript' ? (transcriptNode) : undefined;

  usePageTitle(transcript?.title ?? 'Transcripts');

  const extractedIdeas = useMemo(() => {
    if (!transcript || transcript.extracted_idea_ids.length === 0) return [] as IdeaNode[];

    const ideaSet = new Set(transcript.extracted_idea_ids);
    return (ideaNodes as IdeaNode[]).filter((n) => ideaSet.has(n.id));
  }, [transcript, ideaNodes]);

  const extractionRuns = useMemo((): TranscriptExtractionRun[] => {
    if (!transcript) return [];

    const ideasById = new Map((ideaNodes as IdeaNode[]).map((idea) => [idea.id, idea]));

    return (runNodes as RunNode[])
      .filter((run) => run.skill_id === 'ingest-youtube' && run.produced_node_ids.includes(transcript.id))
      .map((run) => {
        const ideas = run.produced_node_ids
          .filter((nodeId) => nodeId !== transcript.id)
          .map((nodeId) => ideasById.get(nodeId))
          .filter((idea): idea is IdeaNode => idea !== undefined);
        const modelIdea = ideas.find(
          (idea) =>
            idea.llm_model ||
            idea.llm_provider ||
            idea.llm_duration_ms != null ||
            idea.llm_prompt_tokens != null ||
            idea.llm_completion_tokens != null,
        );

        return {
          id: run.id,
          title: run.title,
          startedAt: run.started_at,
          completedAt: run.completed_at,
          durationMs: modelIdea?.llm_duration_ms ?? run.duration_ms,
          model: modelIdea?.llm_model,
          provider: modelIdea?.llm_provider,
          promptTokens: modelIdea?.llm_prompt_tokens,
          completionTokens: modelIdea?.llm_completion_tokens,
          ideaIds: ideas.map((idea) => idea.id),
          ideas,
        };
      })
      .toSorted((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  }, [transcript, ideaNodes, runNodes]);

  if (!id) return <Navigate to="/vault/transcripts" replace />;
  if (!transcriptLoading && !listLoading && !transcript) {
    return <Navigate to="/vault/transcripts" replace />;
  }

  if (listLoading || transcriptLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading transcript…</p>;
  }

  return (
    <TranscriptsSplitView
      transcripts={transcripts}
      selectedId={id}
      transcript={transcript}
      extractedIdeas={extractedIdeas}
      extractionRuns={extractionRuns}
    />
  );
}
