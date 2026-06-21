import type { RunNode, SourceNode, TranscriptNode } from '@llaab/schemas';

import {
  extractMetadataUrl,
  extractRunPublishedAt,
  extractRunSourceId,
  extractRunSubjectHref,
  extractRunSubjectTitle,
} from './metadata-rendering.utils';

const TRANSCRIPT_HREF_PREFIX = '/vault/transcripts/';

export interface RunGroup {
  key: string;
  title: string;
  href?: string;
  url?: string;
  source?: SourceNode;
  totalNodes: number;
  avgDurationMs?: number;
  latestDate: string;
  publishedAt?: string;
  /** True once the group's transcript has a non-empty canonical-idea set. */
  isConsolidated: boolean;
  runs: RunNode[];
}

function extractTranscriptId(href: string | undefined): string | undefined {
  return href?.startsWith(TRANSCRIPT_HREF_PREFIX) ? href.slice(TRANSCRIPT_HREF_PREFIX.length) : undefined;
}

function getRunUrl(run: RunNode): string | undefined {
  return run.input_summary ? extractMetadataUrl(run.input_summary) : undefined;
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Groups runs by the subject they relate to (input URL, falling back to run title). */
export function groupRunsBySubject(
  runs: RunNode[],
  sourcesById: Map<string, SourceNode>,
  transcriptsById: Map<string, TranscriptNode> = new Map(),
): RunGroup[] {
  const groups = new Map<string, RunGroup>();

  for (const run of runs) {
    const url = getRunUrl(run);
    const title = extractRunSubjectTitle(run) ?? run.title;
    const key = url ?? title;

    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        title,
        href: undefined,
        url,
        source: undefined,
        totalNodes: 0,
        avgDurationMs: undefined,
        latestDate: run.created_at,
        isConsolidated: false,
        runs: [],
      };
      groups.set(key, group);
    }

    group.runs.push(run);
    if (run.created_at > group.latestDate) group.latestDate = run.created_at;
    if (!group.href) group.href = extractRunSubjectHref(run);

    if (!group.source) {
      const sourceId = extractRunSourceId(run);
      if (sourceId) group.source = sourcesById.get(sourceId);
    }

    if (!group.publishedAt) {
      const publishedAt = extractRunPublishedAt(run);
      if (publishedAt) group.publishedAt = publishedAt;
    }
  }

  for (const group of groups.values()) {
    group.totalNodes = group.runs.reduce((sum, run) => sum + run.produced_node_ids.length, 0);
    group.avgDurationMs = average(
      group.runs.map((run) => run.duration_ms).filter((value): value is number => value != null),
    );
    group.runs.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const transcriptId = extractTranscriptId(group.href);
    const transcript = transcriptId ? transcriptsById.get(transcriptId) : undefined;
    group.publishedAt ??= transcript?.source_published_at;
    group.isConsolidated = Boolean(transcript?.canonical_coverage?.canonical_idea_ids.length);
  }

  return Array.from(groups.values());
}
