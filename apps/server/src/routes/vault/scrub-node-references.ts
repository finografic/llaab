import { getNodeFilePath, updateNode } from '@llaab/core';
import type {
  CanonicalIdeaNode,
  IdeaNode,
  LabNode,
  RunNode,
  TranscriptCanonicalCoverage,
  TranscriptNode,
} from '@llaab/schemas';

export interface ScrubbedReference {
  id: string;
  type: LabNode['type'];
  changes: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrubCoverage(
  coverage: TranscriptCanonicalCoverage | undefined,
  deletedId: string,
): { coverage: TranscriptCanonicalCoverage | undefined; changed: boolean } {
  if (!coverage) return { coverage, changed: false };

  const next: TranscriptCanonicalCoverage = {
    ...coverage,
    canonical_idea_ids: coverage.canonical_idea_ids,
    candidate_idea_ids: coverage.candidate_idea_ids.filter((id) => id !== deletedId),
    covered_candidate_idea_ids: coverage.covered_candidate_idea_ids.filter((id) => id !== deletedId),
    omitted_candidate_idea_ids: coverage.omitted_candidate_idea_ids.filter((item) => item.id !== deletedId),
    missed_candidate_idea_ids: coverage.missed_candidate_idea_ids.filter((item) => item.id !== deletedId),
  };

  const changed =
    next.candidate_idea_ids.length !== coverage.candidate_idea_ids.length ||
    next.covered_candidate_idea_ids.length !== coverage.covered_candidate_idea_ids.length ||
    next.omitted_candidate_idea_ids.length !== coverage.omitted_candidate_idea_ids.length ||
    next.missed_candidate_idea_ids.length !== coverage.missed_candidate_idea_ids.length;

  return { coverage: changed ? next : coverage, changed };
}

function orphanTagsToRemove(
  transcriptTags: string[],
  deletedIdeaTags: string[],
  remainingSiblingTags: Set<string>,
): Set<string> {
  const removable = new Set<string>();
  for (const tag of deletedIdeaTags) {
    if (!transcriptTags.includes(tag)) continue;
    if (remainingSiblingTags.has(tag)) continue;
    removable.add(tag);
  }
  return removable;
}

/**
 * Scrub inbound references after deleting an idea or resource node.
 * For ideas: also clears extracted_idea_ids / produced_node_ids / source_candidate ids,
 * coverage candidate lists, and transcript tags that only lived on the deleted idea.
 */
export async function scrubNodeReferences(deleted: LabNode, nodes: LabNode[]): Promise<ScrubbedReference[]> {
  const deletedId = deleted.id;
  const scrubbed: ScrubbedReference[] = [];
  const provenanceTagPrefixes = [`from-inbox:${deletedId}`, `to-resource:${deletedId}`];
  const deletedIdeaTags = deleted.type === 'idea' ? deleted.tags : [];
  const ideasById = new Map(
    nodes.filter((node): node is IdeaNode => node.type === 'idea').map((idea) => [idea.id, idea]),
  );

  for (const current of nodes) {
    if (current.id === deletedId) continue;

    const changes: string[] = [];
    const nextRelated = current.related.filter((relatedId) => relatedId !== deletedId);
    if (nextRelated.length !== current.related.length) {
      changes.push('related');
    }

    let nextTags = current.tags.filter(
      (tag) => !provenanceTagPrefixes.includes(tag) && tag !== `inbox:from:${deletedId}`,
    );
    if (nextTags.length !== current.tags.length) {
      changes.push('tags');
    }

    let nextBody = current.body;
    const beforeBody = nextBody;
    nextBody = nextBody
      .replace(new RegExp(`^Source capture:\\s*\`${escapeRegExp(deletedId)}\`\\s*$`, 'gm'), '')
      .replaceAll(`from-inbox:${deletedId}`, '')
      .replaceAll(`to-resource:${deletedId}`, '')
      .replace(/\n{3,}/g, '\n\n');
    if (nextBody !== beforeBody) {
      changes.push('body');
    }

    let nextExtractedIdeaIds: string[] | undefined;
    let nextCanonicalCoverage: TranscriptCanonicalCoverage | undefined;
    let nextProducedNodeIds: string[] | undefined;
    let nextSourceCandidateIdeaIds: string[] | undefined;

    if (current.type === 'transcript' && deleted.type === 'idea') {
      const transcript = current as TranscriptNode;
      nextExtractedIdeaIds = transcript.extracted_idea_ids.filter((id) => id !== deletedId);
      if (nextExtractedIdeaIds.length !== transcript.extracted_idea_ids.length) {
        changes.push('extracted_idea_ids');

        const remainingSiblingTags = new Set<string>();
        for (const ideaId of nextExtractedIdeaIds) {
          const sibling = ideasById.get(ideaId);
          if (!sibling || sibling.id === deletedId) continue;
          for (const tag of sibling.tags) remainingSiblingTags.add(tag);
        }

        const orphans = orphanTagsToRemove(nextTags, deletedIdeaTags, remainingSiblingTags);
        if (orphans.size > 0) {
          nextTags = nextTags.filter((tag) => !orphans.has(tag));
          if (!changes.includes('tags')) changes.push('tags');
        }
      }

      const coverageResult = scrubCoverage(transcript.canonical_coverage, deletedId);
      if (coverageResult.changed) {
        nextCanonicalCoverage = coverageResult.coverage;
        changes.push('canonical_coverage');
      }
    }

    if (current.type === 'run') {
      const run = current as RunNode;
      nextProducedNodeIds = run.produced_node_ids.filter((id) => id !== deletedId);
      if (nextProducedNodeIds.length !== run.produced_node_ids.length) {
        changes.push('produced_node_ids');
      }
    }

    if (current.type === 'canonical-idea' && deleted.type === 'idea') {
      const canonical = current as CanonicalIdeaNode;
      nextSourceCandidateIdeaIds = canonical.source_candidate_idea_ids.filter((id) => id !== deletedId);
      if (nextSourceCandidateIdeaIds.length !== canonical.source_candidate_idea_ids.length) {
        changes.push('source_candidate_idea_ids');
      }
    }

    if (changes.length === 0) continue;

    const cleanedBody = nextBody.trimEnd();
    await updateNode(getNodeFilePath(current.type, current.id), (node) => {
      const patched: LabNode = {
        ...node,
        related: nextRelated,
        tags: nextTags,
        body: cleanedBody.length > 0 ? `${cleanedBody}\n` : '',
        updated_at: new Date().toISOString(),
      };

      if (patched.type === 'transcript') {
        if (nextExtractedIdeaIds) patched.extracted_idea_ids = nextExtractedIdeaIds;
        if (changes.includes('canonical_coverage')) {
          patched.canonical_coverage = nextCanonicalCoverage;
        }
      }

      if (patched.type === 'run' && nextProducedNodeIds) {
        patched.produced_node_ids = nextProducedNodeIds;
      }

      if (patched.type === 'canonical-idea' && nextSourceCandidateIdeaIds) {
        patched.source_candidate_idea_ids = nextSourceCandidateIdeaIds;
      }

      return patched;
    });

    scrubbed.push({ id: current.id, type: current.type, changes });
  }

  return scrubbed;
}

/** Pure helper exported for unit tests. */
export function computeOrphanTagsToRemove(
  transcriptTags: string[],
  deletedIdeaTags: string[],
  remainingSiblingTags: string[],
): string[] {
  return [...orphanTagsToRemove(transcriptTags, deletedIdeaTags, new Set(remainingSiblingTags))].sort();
}
