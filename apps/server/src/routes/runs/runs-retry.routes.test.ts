import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ingestArticle, ingestPodcast, ingestYouTube, listNodes } = vi.hoisted(() => ({
  ingestArticle: vi.fn(),
  ingestPodcast: vi.fn(),
  ingestYouTube: vi.fn(),
  listNodes: vi.fn(),
}));

vi.mock('@llaab/skills', () => ({
  ingestArticle,
  ingestPodcast,
  ingestYouTube,
  reconcileStaleRun: vi.fn(),
  getRunStaleAfterMs: vi.fn(() => 1800000),
}));

vi.mock('@llaab/core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  listNodes,
}));

import type { AppCtx } from '../../types/app.types.js';

import { retry } from './runs.routes.js';

function ctx(runId: string) {
  const captured: { status: number; body: unknown } = { status: 200, body: undefined };

  const c = {
    req: { param: () => ({ id: runId }) },
    json: (payload: unknown, status?: number) => {
      captured.body = payload;
      captured.status = status ?? 200;
      return payload;
    },
  } as unknown as AppCtx;

  return { c, captured };
}

function failedRun(skillId: string, input: Record<string, unknown> = { url: 'https://a.example/x' }) {
  return {
    id: 'run.failed-1',
    type: 'run',
    title: 'A failed run',
    run_status: 'failed',
    skill_id: skillId,
    input_summary: JSON.stringify(input),
    produced_node_ids: [],
  };
}

function successOutput() {
  return {
    record: { runNodeId: 'run.retry-1', status: 'completed' },
    result: { id: 'resource.article' },
    extraction: { ideaIds: ['idea.one'] },
    extractionError: undefined,
  };
}

describe('POST /api/runs/:id/retry — dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches an ingest-article run to ingestArticle', async () => {
    listNodes.mockResolvedValue([
      failedRun('ingest-article', {
        url: 'https://signal.example.com/posts/bounded-fetching',
        tags: ['manual'],
        skipExtraction: true,
      }),
    ]);
    ingestArticle.mockResolvedValue(successOutput());

    const { c, captured } = ctx('run.failed-1');
    await retry.handler(c);

    expect(ingestArticle).toHaveBeenCalledWith({
      url: 'https://signal.example.com/posts/bounded-fetching',
      title: undefined,
      tags: ['manual'],
      skipExtraction: true,
    });
    expect(ingestYouTube).not.toHaveBeenCalled();
    expect(ingestPodcast).not.toHaveBeenCalled();
    expect(captured.status).toBe(200);
    expect(captured.body).toMatchObject({ success: true, runId: 'run.retry-1' });
  });

  it('still dispatches youtube and podcast runs to their own skills', async () => {
    listNodes.mockResolvedValue([failedRun('ingest-youtube')]);
    ingestYouTube.mockResolvedValue(successOutput());
    await retry.handler(ctx('run.failed-1').c);
    expect(ingestYouTube).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    listNodes.mockResolvedValue([failedRun('ingest-podcast')]);
    ingestPodcast.mockResolvedValue(successOutput());
    await retry.handler(ctx('run.failed-1').c);
    expect(ingestPodcast).toHaveBeenCalledTimes(1);
  });

  it('rejects a skill that has no retry path', async () => {
    listNodes.mockResolvedValue([failedRun('consolidate-canonical-ideas')]);

    const { c, captured } = ctx('run.failed-1');
    await retry.handler(c);

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({
      error: expect.stringContaining('ingest-article'),
    });
    expect(ingestArticle).not.toHaveBeenCalled();
  });

  it('rejects a run that did not fail', async () => {
    listNodes.mockResolvedValue([{ ...failedRun('ingest-article'), run_status: 'completed' }]);

    const { c, captured } = ctx('run.failed-1');
    await retry.handler(c);

    expect(captured.status).toBe(400);
    expect(ingestArticle).not.toHaveBeenCalled();
  });

  it('rejects when the original input has no url', async () => {
    listNodes.mockResolvedValue([failedRun('ingest-article', { tags: ['manual'] })]);

    const { c, captured } = ctx('run.failed-1');
    await retry.handler(c);

    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({ error: 'The original run input is missing a url.' });
    expect(ingestArticle).not.toHaveBeenCalled();
  });
});
