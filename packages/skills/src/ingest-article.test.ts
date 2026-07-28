import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/ingestion', () => ({
  ArticleFetchError: class ArticleFetchError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = 'ArticleFetchError';
    }
  },
  createArticleNodes: vi.fn(),
  extractKnowledgeFromNode: vi.fn(),
}));

vi.mock('./runner.js', () => ({
  appendProducedNodeIds: vi.fn(async () => undefined),
  appendRunEvent: vi.fn(async () => undefined),
  runSkill: vi.fn(),
  setRunLlmTrace: vi.fn(async () => undefined),
}));

import { createArticleNodes, extractKnowledgeFromNode } from '@llaab/ingestion';
import type { ArticleIngestionResult } from '@llaab/ingestion';

import { ingestArticle } from './ingest-article.js';
import { appendProducedNodeIds, appendRunEvent, runSkill, setRunLlmTrace } from './runner.js';

const RUN_NODE_ID = 'run.ingest-article-1';

function articleResult(overrides: Partial<ArticleIngestionResult> = {}): ArticleIngestionResult {
  return {
    id: 'resource.bounded-fetching',
    path: '/vault/resources/resource.bounded-fetching.md',
    type: 'resource',
    title: 'Bounded Fetching for Knowledge Systems',
    sourceId: 'signal-journal',
    sourceUrl: 'https://signal.example.com/posts/bounded-fetching',
    canonicalUrl: 'https://signal.example.com/posts/bounded-fetching',
    contentHash: 'a'.repeat(64),
    plainText: 'Article plain text long enough to extract from.',
    producedNodeIds: ['resource.bounded-fetching', 'signal-journal'],
    reused: false,
    runTrace: { stages: [], decisions: [] },
    ...overrides,
  };
}

/** Runs the skill body the way the real runner does, so run events are exercised. */
function stubRunSkill(result: ArticleIngestionResult, status: 'completed' | 'failed' = 'completed') {
  type SkillBody = (input: unknown, runNodeId: string) => Promise<ArticleIngestionResult>;

  vi.mocked(runSkill).mockImplementation((async (_skillId: string, body: SkillBody, input: unknown) => {
    const value = await body(input, RUN_NODE_ID);
    return { record: { runNodeId: RUN_NODE_ID, status }, result: value };
  }) as never);

  vi.mocked(createArticleNodes).mockResolvedValue(result);
}

function extractionResult(ideaIds: string[]) {
  return {
    nodeId: 'resource.bounded-fetching',
    summary: 'An article summary.',
    ideaIds,
    ideas: ideaIds.map((id) => ({ id, title: id })),
    llmMeta: { model: 'glm-5.2', provider: 'opencode', durationMs: 1200 },
  };
}

describe('ingestArticle — success', () => {
  afterEach(() => vi.clearAllMocks());

  it('saves the article, then extracts, and reports both', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockResolvedValue(extractionResult(['idea.one', 'idea.two']));

    const output = await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    expect(output.result.id).toBe('resource.bounded-fetching');
    expect(output.extraction?.ideaIds).toEqual(['idea.one', 'idea.two']);
    expect(output.extractionError).toBeUndefined();

    expect(extractKnowledgeFromNode).toHaveBeenCalledWith(
      'resource.bounded-fetching',
      '/vault/resources/resource.bounded-fetching.md',
      'Article plain text long enough to extract from.',
      undefined,
    );
    expect(appendProducedNodeIds).toHaveBeenCalledWith(
      RUN_NODE_ID,
      ['idea.one', 'idea.two'],
      expect.objectContaining({ completedAt: expect.any(String) }),
    );
    expect(setRunLlmTrace).toHaveBeenCalledWith(
      RUN_NODE_ID,
      expect.objectContaining({ model: 'glm-5.2', provider: 'opencode' }),
    );
  });

  it('emits fetch, save, extraction-start, and extraction-success events in order', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockResolvedValue(extractionResult(['idea.one']));

    await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    const events = vi.mocked(appendRunEvent).mock.calls.map(([, event]) => ({
      level: event.level,
      message: event.message,
    }));

    expect(events).toEqual([
      { level: 'info', message: 'Fetching article https://signal.example.com/posts/bounded-fetching' },
      { level: 'success', message: 'Saved article "Bounded Fetching for Knowledge Systems"' },
      { level: 'info', message: 'Extracting ideas from article' },
      { level: 'success', message: 'Extracted 1 idea' },
    ]);
  });

  it('records the article and publication source as produced nodes', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockResolvedValue(extractionResult([]));

    await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    expect(vi.mocked(appendRunEvent).mock.calls[1]?.[1]).toMatchObject({
      node_ids: ['resource.bounded-fetching', 'signal-journal'],
      href: '/vault/resources/resource.bounded-fetching',
    });
  });

  it('passes the inbox capture through as provenance', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockResolvedValue(extractionResult([]));

    await ingestArticle({
      url: 'https://signal.example.com/posts/bounded-fetching',
      inboxCaptureId: 'inbox.capture-9',
      tags: ['manual'],
      title: 'Override',
    });

    expect(createArticleNodes).toHaveBeenCalledWith({
      url: 'https://signal.example.com/posts/bounded-fetching',
      title: 'Override',
      tags: ['manual'],
      inboxCaptureId: 'inbox.capture-9',
    });
  });
});

describe('ingestArticle — dedupe and skipExtraction', () => {
  afterEach(() => vi.clearAllMocks());

  it('reports reuse rather than a fresh save', async () => {
    stubRunSkill(articleResult({ reused: true, producedNodeIds: ['resource.bounded-fetching'] }));
    vi.mocked(extractKnowledgeFromNode).mockResolvedValue(extractionResult([]));

    await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    expect(vi.mocked(appendRunEvent).mock.calls[1]?.[1].message).toBe(
      'Reused existing article "Bounded Fetching for Knowledge Systems"',
    );
  });

  it('skips extraction when asked, leaving the article saved', async () => {
    stubRunSkill(articleResult());

    const output = await ingestArticle({
      url: 'https://signal.example.com/posts/bounded-fetching',
      skipExtraction: true,
    });

    expect(extractKnowledgeFromNode).not.toHaveBeenCalled();
    expect(output.extraction).toBeUndefined();
    expect(output.result.id).toBe('resource.bounded-fetching');
  });
});

describe('ingestArticle — extraction failure', () => {
  afterEach(() => vi.clearAllMocks());

  it('keeps the saved article and reports the failure as a warning', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockRejectedValue(new Error('LLM unavailable'));

    const output = await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    expect(output.result.id).toBe('resource.bounded-fetching');
    expect(output.extractionError).toBe('LLM unavailable');
    expect(output.extraction).toBeUndefined();

    const lastEvent = vi.mocked(appendRunEvent).mock.calls.at(-1)?.[1];
    expect(lastEvent).toMatchObject({
      level: 'warning',
      message: 'Extraction failed (article saved): LLM unavailable',
    });
  });

  it('does not mark the run failed when only extraction failed', async () => {
    stubRunSkill(articleResult());
    vi.mocked(extractKnowledgeFromNode).mockRejectedValue(new Error('LLM unavailable'));

    const output = await ingestArticle({ url: 'https://signal.example.com/posts/bounded-fetching' });

    expect(output.record.status).toBe('completed');
  });
});

describe('ingestArticle — fetch failure', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns the failed record and never attempts extraction', async () => {
    stubRunSkill(articleResult(), 'failed');

    const output = await ingestArticle({ url: 'https://spa.example.com/' });

    expect(output.record.status).toBe('failed');
    expect(extractKnowledgeFromNode).not.toHaveBeenCalled();
  });
});
