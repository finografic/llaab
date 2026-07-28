import { deleteNode, getNodeFilePath, listNodes, readNode } from '@llaab/core';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { DeleteRunsPreviewBody } from './vault.schema.js';
import type {
  CanonicalIdeaNode,
  LabNode,
  ResourceNode,
  RunNode,
  TranscriptNode,
  WikiDraftNode,
} from '@llaab/schemas';

import { deleteRunQuerySchema } from './vault.schema.js';

// ---------------------------------------------------------------------------
// Produced-node retention helpers
// ---------------------------------------------------------------------------

interface ProducedNodeDeleteContext {
  nodesById: Map<string, LabNode>;
  remainingRuns: RunNode[];
  transcripts: TranscriptNode[];
  resources: ResourceNode[];
  canonicalIdeas: CanonicalIdeaNode[];
  wikiDrafts: WikiDraftNode[];
}

function buildProducedNodeDeleteContext(allNodes: LabNode[], deletingRunIds: Set<string>) {
  return {
    nodesById: new Map(allNodes.map((node) => [node.id, node])),
    remainingRuns: allNodes.filter(
      (node): node is RunNode => node.type === 'run' && !deletingRunIds.has(node.id),
    ),
    transcripts: allNodes.filter((node): node is TranscriptNode => node.type === 'transcript'),
    resources: allNodes.filter((node): node is ResourceNode => node.type === 'resource'),
    canonicalIdeas: allNodes.filter((node): node is CanonicalIdeaNode => node.type === 'canonical-idea'),
    wikiDrafts: allNodes.filter((node): node is WikiDraftNode => node.type === 'wiki-draft'),
  } satisfies ProducedNodeDeleteContext;
}

function canDeleteProducedNode(node: LabNode, context: ProducedNodeDeleteContext): boolean {
  return getProducedNodeRetentionReason(node, context) === null;
}

/** Returns a human-readable reason the node would be preserved, or null if it can be deleted. */
function getProducedNodeRetentionReason(node: LabNode, context: ProducedNodeDeleteContext): string | null {
  const referencingRun = context.remainingRuns.find((run) => run.produced_node_ids.includes(node.id));
  if (referencingRun) return `still referenced by run "${referencingRun.title}"`;

  const referencingWikiDraft = context.wikiDrafts.find(
    (draft) =>
      draft.source_canonical_idea_ids.includes(node.id) ||
      draft.source_transcript_ids.includes(node.id) ||
      draft.source_ids.includes(node.id),
  );
  if (referencingWikiDraft) return `referenced by wiki draft "${referencingWikiDraft.title}"`;

  if (node.type === 'idea') {
    const referencingIdea = context.canonicalIdeas.find((idea) =>
      idea.source_candidate_idea_ids.includes(node.id),
    );
    if (referencingIdea) return `used as a source for canonical idea "${referencingIdea.title}"`;
    return null;
  }

  if (node.type === 'transcript') {
    const referencingIdea = context.canonicalIdeas.find((idea) => idea.transcript_id === node.id);
    if (referencingIdea) return `referenced by canonical idea "${referencingIdea.title}"`;
    return null;
  }

  if (node.type === 'source') {
    const referencingTranscript = context.transcripts.find((transcript) => transcript.source_id === node.id);
    if (referencingTranscript) return `referenced by transcript "${referencingTranscript.title}"`;

    // A publication source is shared by every article from that site, so discarding one article's
    // run must not delete a source another article still points at.
    const referencingResource = context.resources.find((resource) => resource.source_id === node.id);
    if (referencingResource) return `referenced by resource "${referencingResource.title}"`;

    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const deleteRun = {
  path: '/runs/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const { deleteProduced: deleteProducedParam } = deleteRunQuerySchema.parse({
      deleteProduced: c.req.query('deleteProduced'),
    });
    const deleteProduced = deleteProducedParam === 'true';

    const runPath = getNodeFilePath('run', id);
    let run: RunNode;
    try {
      run = (await readNode(runPath)) as RunNode;
    } catch {
      return c.json({ error: 'Run not found' }, 404);
    }

    let deletedProduced = 0;
    if (deleteProduced && run.produced_node_ids.length > 0) {
      const allNodes = await listNodes();
      const deleteContext = buildProducedNodeDeleteContext(allNodes, new Set([run.id]));

      for (const nodeId of run.produced_node_ids) {
        const producedNode = deleteContext.nodesById.get(nodeId);
        if (!producedNode) continue;
        if (!canDeleteProducedNode(producedNode, deleteContext)) continue;

        try {
          await deleteNode(producedNode.type, nodeId);
          deletedProduced++;
        } catch {
          /* best-effort */
        }
      }
    }

    await deleteNode('run', id);
    return c.json({ success: true, deletedProduced });
  },
};

export const previewDeleteRuns = {
  path: '/runs/delete-preview' as const,
  handler: async (c: AppCtxJson<DeleteRunsPreviewBody>) => {
    const { ids } = c.req.valid('json');

    const allNodes = await listNodes();
    const runsById = new Map(
      allNodes.filter((node): node is RunNode => node.type === 'run').map((run) => [run.id, run]),
    );

    const runs: Array<{ id: string; title: string }> = [];
    const deletingRunIds = new Set<string>();
    for (const id of ids) {
      const run = runsById.get(id);
      if (!run) continue;
      runs.push({ id: run.id, title: run.title });
      deletingRunIds.add(run.id);
    }

    const deleteContext = buildProducedNodeDeleteContext(allNodes, deletingRunIds);
    const producedNodeIds = new Set(
      [...deletingRunIds].flatMap((id) => runsById.get(id)?.produced_node_ids ?? []),
    );

    const toDelete: Array<{ id: string; type: string; title: string }> = [];
    const preserved: Array<{ id: string; type: string; title: string; reason: string }> = [];

    for (const nodeId of producedNodeIds) {
      const node = deleteContext.nodesById.get(nodeId);
      if (!node) continue;
      const reason = getProducedNodeRetentionReason(node, deleteContext);
      if (reason === null) {
        toDelete.push({ id: node.id, type: node.type, title: node.title });
      } else {
        preserved.push({ id: node.id, type: node.type, title: node.title, reason });
      }
    }

    // Canonical ideas tied to transcripts/candidates produced by these runs remain untouched
    // (they are what force those nodes into `preserved`), but are surfaced for visibility.
    const canonicalIdeasAffected = deleteContext.canonicalIdeas
      .filter(
        (idea) =>
          (idea.transcript_id && producedNodeIds.has(idea.transcript_id)) ||
          idea.source_candidate_idea_ids.some((sourceId) => producedNodeIds.has(sourceId)),
      )
      .map((idea) => ({ id: idea.id, title: idea.title, transcriptId: idea.transcript_id }));

    return c.json({ runs, toDelete, preserved, canonicalIdeasAffected });
  },
};
