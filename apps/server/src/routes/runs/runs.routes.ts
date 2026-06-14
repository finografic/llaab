import { getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import { ingestYouTube } from '@llaab/skills';
import type { AppCtx } from '../../types/app.types.js';
import type { LabNode, RunMonitorItem, RunMonitorStep, RunNode } from '@llaab/schemas';

const ACTIVE_STATUSES = new Set<RunNode['run_status']>(['pending', 'running']);
const SUMMARY_MAX_LENGTH = 180;

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function isActiveRun(run: RunNode): boolean {
  return ACTIVE_STATUSES.has(run.run_status);
}

function nodeHref(node: LabNode): string {
  switch (node.type) {
    case 'run':
      return `/vault/runs/${node.id}`;
    case 'source':
      return `/vault/sources/${node.id}`;
    case 'transcript':
      return `/vault/transcripts/${node.id}`;
    default:
      return `/vault/nodes/${node.id}`;
  }
}

function stageToStep(stage: RunNode['stages'][number], index: number): RunMonitorStep {
  return {
    id: `${index}-${stage.name}`,
    title: titleCase(stage.name),
    status: stage.status,
    detail: stage.error,
  };
}

function decodeEscapedJsonQuotes(value: string): string {
  let candidate = value;

  for (let pass = 0; pass < 6; pass++) {
    const decoded = candidate.replace(/\\+"/g, '"');
    if (decoded === candidate) return candidate;
    candidate = decoded;
  }

  return candidate;
}

function parseMetadataJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let candidate = trimmed;
  for (let pass = 0; pass < 6; pass++) {
    try {
      const decoded = JSON.parse(candidate) as unknown;
      if (typeof decoded !== 'string') return decoded;

      const nested = decoded.trim();
      if (!nested || nested === candidate) return decoded;
      candidate = nested;
      continue;
    } catch {
      // Not parseable at this escape depth.
    }

    const unescaped = decodeEscapedJsonQuotes(candidate);
    if (unescaped === candidate) break;
    candidate = unescaped;
  }

  return undefined;
}

function readSummaryString(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = (value as Record<string, unknown>)[field];
  if (typeof candidate !== 'string') return undefined;

  const trimmed = candidate.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function truncateSummary(value: string): string {
  if (value.length <= SUMMARY_MAX_LENGTH) return value;
  return `${value.slice(0, SUMMARY_MAX_LENGTH - 1)}…`;
}

function formatRunSummary(value?: string): string | undefined {
  if (!value) return undefined;

  const parsed = parseMetadataJson(value);
  if (!parsed || typeof parsed !== 'object') return truncateSummary(decodeEscapedJsonQuotes(value));

  const title = readSummaryString(parsed, 'title');
  const author = readSummaryString(parsed, 'author');
  const url = readSummaryString(parsed, 'sourceUrl') ?? readSummaryString(parsed, 'url');

  if (title && author) return `${title} · ${author}`;
  if (title) return title;
  if (url) return url;

  return undefined;
}

function runToMonitorItem(run: RunNode, nodesById: Map<string, LabNode>): RunMonitorItem {
  const primaryNode = run.produced_node_ids
    .map((nodeId) => nodesById.get(nodeId))
    .find((node) => node != null);

  return {
    id: run.id,
    title: run.title,
    status: run.run_status,
    skill_id: run.skill_id,
    started_at: run.started_at,
    completed_at: run.completed_at,
    duration_ms: run.duration_ms,
    input_summary: formatRunSummary(run.input_summary),
    output_summary: formatRunSummary(run.output_summary),
    error: run.error,
    produced_node_count: run.produced_node_ids.length,
    primary_link: primaryNode ? { label: primaryNode.title, href: nodeHref(primaryNode) } : undefined,
    run_link: { label: run.id, href: `/vault/runs/${run.id}` },
    steps: run.stages.map(stageToStep),
    events: run.events,
    model: run.llm?.model ?? run.model_used,
    provider: run.llm?.provider,
    prompt_tokens: run.llm?.prompt_tokens,
    completion_tokens: run.llm?.completion_tokens,
  };
}

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) => {
    const all = await listNodes({ type: 'run' });
    const runs = (all as RunNode[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return c.json({ runs });
  },
};

export const monitor = {
  path: '/monitor' as const,
  handler: async (c: AppCtx) => {
    const limit = Number(c.req.query('limit') ?? 10);
    const all = await listNodes();
    const nodesById = new Map(all.map((node) => [node.id, node]));
    const runs = all
      .filter((node): node is RunNode => node.type === 'run')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const activeRuns = runs.filter(isActiveRun);
    const recentRuns = runs
      .filter((run) => !isActiveRun(run) && !run.monitor_dismissed_at)
      .slice(0, Number.isFinite(limit) ? limit : 10);

    return c.json({
      active: activeRuns.map((run) => runToMonitorItem(run, nodesById)),
      recent: recentRuns.map((run) => runToMonitorItem(run, nodesById)),
    });
  },
};

export const detail = {
  path: '/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const all = await listNodes({ type: 'run' });
    const run = (all as RunNode[]).find((r) => r.id === id);
    if (!run) return c.json({ error: 'Run not found' }, 404);
    return c.json({ run });
  },
};

export const dismiss = {
  path: '/:id/dismiss' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();

    const runPath = getNodeFilePath('run', id);
    try {
      const updated = await updateNode(runPath, (current) => ({
        ...current,
        monitor_dismissed_at: formatIsoUtcSeconds(new Date()),
      }));
      return c.json({ success: true, run: updated.node as RunNode });
    } catch {
      return c.json({ error: 'Run not found' }, 404);
    }
  },
};

export const retry = {
  path: '/:id/retry' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const all = await listNodes({ type: 'run' });
    const run = (all as RunNode[]).find((r) => r.id === id);
    if (!run) return c.json({ error: 'Run not found' }, 404);
    if (run.run_status !== 'failed') {
      return c.json({ error: 'Only failed runs can be retried.' }, 400);
    }
    if (run.skill_id !== 'ingest-youtube') {
      return c.json({ error: 'Retry is only supported for ingest-youtube runs.' }, 400);
    }

    let input: { url?: string; title?: string; tags?: string[]; skipExtraction?: boolean };
    try {
      input = JSON.parse(run.input_summary ?? '');
    } catch {
      return c.json({ error: 'Unable to parse the original run input for retry.' }, 400);
    }
    if (!input.url) {
      return c.json({ error: 'The original run input is missing a url.' }, 400);
    }

    const { record, result, extraction, extractionError } = await ingestYouTube({
      url: input.url,
      title: input.title,
      tags: input.tags,
      skipExtraction: input.skipExtraction,
    });

    if (record.status === 'failed') {
      return c.json(
        { success: false as const, runId: record.runNodeId, error: record.error ?? 'Retry failed.' },
        500,
      );
    }

    return c.json({
      success: true as const,
      runId: record.runNodeId,
      result: { id: result.id },
      extraction: extraction ? { ideaCount: extraction.ideaIds.length } : null,
      extractionError: extractionError ?? null,
    });
  },
};
