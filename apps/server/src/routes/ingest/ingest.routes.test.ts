import { describe, expect, it, vi } from 'vitest';

const { ingestArticle } = vi.hoisted(() => ({ ingestArticle: vi.fn() }));

vi.mock('@llaab/skills', () => ({
  ingestArticle,
  ingestPodcast: vi.fn(),
  ingestYouTube: vi.fn(),
}));

import type { AppCtxJson } from '../../types/app.types.js';
import type { IngestArticleBody } from './ingest.schema.js';

import { article } from './ingest.routes.js';
import { ingestArticleBodySchema } from './ingest.schema.js';

/** Captures the status alongside the body so failure responses can be asserted. */
function ctx(body: IngestArticleBody) {
  const captured: { status: number; body: unknown } = { status: 200, body: undefined };

  const c = {
    req: { valid: () => body },
    json: (payload: unknown, status?: number) => {
      captured.body = payload;
      captured.status = status ?? 200;
      return payload;
    },
  } as unknown as AppCtxJson<IngestArticleBody>;

  return { c, captured };
}

function skillOutput(overrides: Record<string, unknown> = {}) {
  return {
    record: { runNodeId: 'run.article-1', status: 'completed' },
    result: {
      id: 'resource.bounded-fetching',
      path: '/vault/resources/resource.bounded-fetching.md',
      type: 'resource',
      title: 'Bounded Fetching',
      canonicalUrl: 'https://signal.example.com/posts/bounded-fetching',
      sourceId: 'signal-journal',
      reused: false,
    },
    extraction: { ideaIds: ['idea.one'], summary: 'A summary.' },
    extractionError: undefined,
    ...overrides,
  };
}

describe('ingestArticleBodySchema', () => {
  it('requires a valid URL', () => {
    expect(ingestArticleBodySchema.safeParse({ url: 'not a url' }).success).toBe(false);
    expect(ingestArticleBodySchema.safeParse({}).success).toBe(false);
    expect(ingestArticleBodySchema.safeParse({ url: 'https://example.com/a' }).success).toBe(true);
  });

  it('accepts the optional title, tags, skipExtraction, and inbox provenance', () => {
    const parsed = ingestArticleBodySchema.parse({
      url: 'https://example.com/a',
      title: 'Override',
      tags: ['manual'],
      skipExtraction: true,
      inboxCaptureId: 'inbox.capture-1',
    });

    expect(parsed).toMatchObject({
      title: 'Override',
      tags: ['manual'],
      skipExtraction: true,
      inboxCaptureId: 'inbox.capture-1',
    });
  });
});

describe('POST /api/ingest/article', () => {
  it('is registered at /article', () => {
    expect(article.path).toBe('/article');
  });

  it('passes the whole body through to the skill', async () => {
    ingestArticle.mockResolvedValue(skillOutput());
    const { c } = ctx({
      url: 'https://signal.example.com/posts/bounded-fetching',
      title: 'Override',
      tags: ['manual'],
      skipExtraction: false,
      inboxCaptureId: 'inbox.capture-1',
    });

    await article.handler(c);

    expect(ingestArticle).toHaveBeenCalledWith({
      url: 'https://signal.example.com/posts/bounded-fetching',
      title: 'Override',
      tags: ['manual'],
      skipExtraction: false,
      inboxCaptureId: 'inbox.capture-1',
    });
  });

  it('returns the article identity, source, and extraction summary', async () => {
    ingestArticle.mockResolvedValue(skillOutput());
    const { c, captured } = ctx({ url: 'https://signal.example.com/posts/bounded-fetching' });

    await article.handler(c);

    expect(captured.status).toBe(200);
    expect(captured.body).toEqual({
      success: true,
      result: {
        id: 'resource.bounded-fetching',
        path: '/vault/resources/resource.bounded-fetching.md',
        type: 'resource',
        title: 'Bounded Fetching',
        canonicalUrl: 'https://signal.example.com/posts/bounded-fetching',
        sourceId: 'signal-journal',
        reused: false,
      },
      extraction: { ideaCount: 1, summary: 'A summary.' },
      extractionError: null,
    });
  });

  it('reports a saved article with a failed extraction as a success', async () => {
    ingestArticle.mockResolvedValue(
      skillOutput({ extraction: undefined, extractionError: 'LLM unavailable' }),
    );
    const { c, captured } = ctx({ url: 'https://signal.example.com/posts/bounded-fetching' });

    await article.handler(c);

    expect(captured.status).toBe(200);
    expect(captured.body).toMatchObject({
      success: true,
      extraction: null,
      extractionError: 'LLM unavailable',
    });
  });

  it('returns 500 when the run failed', async () => {
    ingestArticle.mockResolvedValue(
      skillOutput({ record: { runNodeId: 'run.article-1', status: 'failed', error: 'blocked_target' } }),
    );
    const { c, captured } = ctx({ url: 'http://127.0.0.1/admin' });

    await article.handler(c);

    expect(captured.status).toBe(500);
    expect(captured.body).toEqual({ success: false, error: 'blocked_target' });
  });
});
