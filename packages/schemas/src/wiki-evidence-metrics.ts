import { z } from 'zod';

import { NodeIdSchema } from './primitives.schema.js';

/** Explicit evidence/source diversity counts — never conflate citation refs with independent sources. */
export const WikiEvidenceMetricsSchema = z.object({
  evidence_ref_count: z.number().int().nonnegative(),
  unique_canonical_idea_count: z.number().int().nonnegative(),
  unique_transcript_count: z.number().int().nonnegative(),
  unique_source_node_count: z.number().int().nonnegative(),
  unique_author_channel_count: z.number().int().nonnegative(),
  independent_source_count: z.number().int().nonnegative(),
  unknown_source_identity_count: z.number().int().nonnegative().default(0),
});

export type WikiEvidenceMetrics = z.infer<typeof WikiEvidenceMetricsSchema>;

export type WikiSourceOriginKind = 'author-channel' | 'source-node' | 'transcript' | 'external' | 'unknown';

export interface WikiSourceOriginIdentity {
  kind: WikiSourceOriginKind;
  /** Stable origin key used for independent-source grouping. */
  id: string;
}

export interface WikiEvidenceMetricInput {
  id: string;
  transcript_id?: string;
  source_id?: string;
  author?: string;
  channel?: string;
  canonical_idea_ids?: string[];
  kind?: 'canonical-idea' | 'transcript' | 'source' | 'external';
  url?: string;
}

function normalizeIdentityToken(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function externalHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLocaleLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Conservative source-origin identity.
 * Multiple excerpts/timestamps from one transcript share one origin.
 * Missing metadata stays unknown and must not invent diversity.
 */
export function resolveWikiSourceOriginIdentity(input: {
  transcriptId?: string;
  sourceNodeId?: string;
  author?: string;
  channel?: string;
  externalUrl?: string;
}): WikiSourceOriginIdentity {
  const channel = input.channel ? normalizeIdentityToken(input.channel) : undefined;
  const author = input.author ? normalizeIdentityToken(input.author) : undefined;
  if (channel) return { kind: 'author-channel', id: `author-channel:${channel}` };
  if (author) return { kind: 'author-channel', id: `author-channel:${author}` };

  if (input.sourceNodeId) {
    return { kind: 'source-node', id: `source-node:${input.sourceNodeId}` };
  }

  const host = externalHost(input.externalUrl);
  if (host) return { kind: 'external', id: `external:${host}` };

  if (input.transcriptId) {
    return { kind: 'transcript', id: `transcript:${input.transcriptId}` };
  }

  return { kind: 'unknown', id: 'unknown' };
}

/**
 * Compute display and gate metrics from evidence/source refs.
 * Independent sources collapse by author/channel when known; otherwise by source node,
 * external host, or transcript. Unknown identities never inflate independence.
 */
export function computeWikiEvidenceMetrics(items: WikiEvidenceMetricInput[]): WikiEvidenceMetrics {
  const evidenceRefIds = new Set<string>();
  const canonicalIdeaIds = new Set<string>();
  const transcriptIds = new Set<string>();
  const sourceNodeIds = new Set<string>();
  const authorChannels = new Set<string>();
  const independentOrigins = new Set<string>();
  let unknownSourceIdentityCount = 0;

  for (const item of items) {
    evidenceRefIds.add(item.id);
    for (const ideaId of item.canonical_idea_ids ?? []) {
      if (NodeIdSchema.safeParse(ideaId).success) canonicalIdeaIds.add(ideaId);
    }
    if (item.transcript_id) transcriptIds.add(item.transcript_id);
    if (item.source_id) sourceNodeIds.add(item.source_id);

    const channel = item.channel ? normalizeIdentityToken(item.channel) : undefined;
    const author = item.author ? normalizeIdentityToken(item.author) : undefined;
    if (channel) authorChannels.add(channel);
    else if (author) authorChannels.add(author);

    const origin = resolveWikiSourceOriginIdentity({
      transcriptId: item.transcript_id,
      sourceNodeId: item.source_id,
      author: item.author,
      channel: item.channel,
      externalUrl: item.kind === 'external' ? item.url : undefined,
    });

    if (origin.kind === 'unknown') {
      unknownSourceIdentityCount += 1;
      continue;
    }
    independentOrigins.add(origin.id);
  }

  return WikiEvidenceMetricsSchema.parse({
    evidence_ref_count: evidenceRefIds.size,
    unique_canonical_idea_count: canonicalIdeaIds.size,
    unique_transcript_count: transcriptIds.size,
    unique_source_node_count: sourceNodeIds.size,
    unique_author_channel_count: authorChannels.size,
    independent_source_count: independentOrigins.size,
    unknown_source_identity_count: unknownSourceIdentityCount,
  });
}
