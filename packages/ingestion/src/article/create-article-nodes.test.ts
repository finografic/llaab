import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@llaab/core', () => ({
  autoTag: vi.fn(() => []),
  createNode: vi.fn(),
  getNodeFilePath: vi.fn((type: string, id: string) => `/vault/${type}s/${type}.${id}.md`),
  listNodes: vi.fn(async () => []),
  updateNode: vi.fn(async () => ({ path: '', node: {} })),
}));

import { autoTag, createNode, listNodes, updateNode } from '@llaab/core';
import type { LabNode } from '@llaab/schemas';

import { readArticleFixture } from '../fetch/article/__fixtures__/index.js';
import { ArticleFetchError, createArticleNodes } from './create-article-nodes.js';

const articleHtml = readArticleFixture('semanticArticle');
const ARTICLE_URL = 'https://signal.example.com/posts/bounded-fetching';
const CANONICAL = 'https://signal.example.com/posts/bounded-fetching';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];

function htmlFetch(body = articleHtml, init: ResponseInit = {}): typeof fetch {
  return (async () =>
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
      ...init,
    })) as unknown as typeof fetch;
}

function fetchOptions(fetchImpl: typeof fetch = htmlFetch()) {
  return { fetchImpl, resolveHost: publicDns };
}

/** Records created nodes and returns realistic ids so relations can be asserted. */
function stubCreateNode() {
  const created: Array<{ type: string; title: string; extra?: Record<string, unknown>; body?: string }> = [];

  vi.mocked(createNode).mockImplementation(async (input) => {
    created.push({
      type: input.type,
      title: input.title,
      ...(input.extra ? { extra: input.extra } : {}),
      ...(input.body ? { body: input.body } : {}),
    });
    const id = input.id ?? `${input.type}.${input.title.toLowerCase().replace(/[^a-z\d]+/g, '-')}`;
    return { id, path: `/vault/${input.type}s/${input.type}.${id}.md`, node: {} as never };
  });

  return created;
}

function resourceNode(overrides: Partial<Record<string, unknown>> = {}): LabNode {
  return {
    id: 'resource.existing-article',
    type: 'resource',
    title: 'Existing article',
    status: 'seed',
    tags: [],
    related: [],
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    body: 'stored article body',
    resource_type: 'article',
    url: CANONICAL,
    source_id: 'signal-journal',
    extracted_idea_ids: [],
    ...overrides,
  } as unknown as LabNode;
}

describe('createArticleNodes — first ingest', () => {
  afterEach(() => vi.clearAllMocks());

  it('creates the publication source before the article and links them', async () => {
    const created = stubCreateNode();

    const result = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(created.map((node) => node.type)).toEqual(['source', 'resource']);
    expect(created[0]).toMatchObject({
      type: 'source',
      title: 'Signal Journal',
      extra: expect.objectContaining({ source_kind: 'publication', url: 'https://signal.example.com' }),
    });
    expect(result.sourceId).toBe('signal-journal');
    expect(updateNode).toHaveBeenCalledWith('/vault/sources/source.signal-journal.md', expect.any(Function));
  });

  it('persists article provenance on the resource node', async () => {
    const created = stubCreateNode();

    // A shortener redirects to the publisher; the canonical link is only honoured because the
    // terminal response is on the same host.
    let hop = 0;
    const redirectingFetch = (async () => {
      hop += 1;
      return hop === 1
        ? new Response(null, { status: 302, headers: { location: ARTICLE_URL } })
        : new Response(articleHtml, { status: 200, headers: { 'content-type': 'text/html' } });
    }) as unknown as typeof fetch;

    await createArticleNodes({
      url: 'https://sho.rt/abc',
      fetchOptions: fetchOptions(redirectingFetch),
    });

    expect(created[1]?.extra).toMatchObject({
      resource_type: 'article',
      url: CANONICAL,
      requested_url: 'https://sho.rt/abc',
      source_id: 'signal-journal',
      author: 'Dana Okonkwo',
      site_name: 'Signal Journal',
      source_published_at: '2026-05-14T09:30:00.000Z',
      content_truncated: false,
    });
    expect(created[1]?.extra?.content_hash).toMatch(/^[\da-f]{64}$/);
    expect(created[1]?.extra?.fetched_at).toEqual(expect.any(String));
  });

  it('stores a readable Markdown body with a header and no raw HTML', async () => {
    const created = stubCreateNode();

    await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });
    const body = created[1]?.body ?? '';

    expect(body).toMatch(/^# Bounded Fetching for Knowledge Systems/);
    expect(body).toContain(`[**${CANONICAL}**](${CANONICAL})`);
    expect(body).toContain('**author:** Dana Okonkwo');
    expect(body).toContain('## Article');
    expect(body).not.toContain('<p>');
  });

  it('returns everything the run needs without having called an LLM', async () => {
    stubCreateNode();

    const result = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(result).toMatchObject({
      type: 'resource',
      title: 'Bounded Fetching for Knowledge Systems',
      canonicalUrl: CANONICAL,
      reused: false,
      sourceId: 'signal-journal',
    });
    expect(result.producedNodeIds).toEqual([result.id, 'signal-journal']);
    expect(result.plainText).toContain('single owning module');
    expect(result.runTrace.stages.map((stage) => stage.name)).toEqual([
      'fetch:article',
      'store:source',
      'store:article',
    ]);
  });

  it('honours an operator title override and manual tags', async () => {
    const created = stubCreateNode();
    vi.mocked(autoTag).mockReturnValue(['d:web']);

    const result = await createArticleNodes({
      url: ARTICLE_URL,
      title: 'Operator chosen title',
      tags: ['manual'],
      fetchOptions: fetchOptions(),
    });

    expect(result.title).toBe('Operator chosen title');
    expect(created[1]?.body).toMatch(/^# Operator chosen title/);
  });

  it('relates the originating inbox capture when one is supplied', async () => {
    const created = stubCreateNode();

    await createArticleNodes({
      url: ARTICLE_URL,
      inboxCaptureId: 'inbox.capture-123',
      fetchOptions: fetchOptions(),
    });

    expect(created[1]?.extra).toMatchObject({ related: ['inbox.capture-123'] });
  });
});

describe('createArticleNodes — deduplication', () => {
  afterEach(() => vi.clearAllMocks());

  it('reuses an existing article with the same canonical URL', async () => {
    stubCreateNode();
    vi.mocked(listNodes).mockResolvedValue([resourceNode()]);

    const result = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(result.reused).toBe(true);
    expect(result.id).toBe('resource.existing-article');
    expect(result.plainText).toBe('stored article body');
    expect(createNode).not.toHaveBeenCalled();
    expect(result.runTrace.stages.map((stage) => stage.name)).toEqual(['fetch:article', 'dedupe:article']);
  });

  it('reuses an existing article that matches only by content hash', async () => {
    stubCreateNode();

    // Learn the hash this fixture produces, then present a node stored under a different URL.
    vi.mocked(listNodes).mockResolvedValue([]);
    const first = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });
    vi.clearAllMocks();

    stubCreateNode();
    vi.mocked(listNodes).mockResolvedValue([
      resourceNode({
        url: 'https://signal.example.com/posts/moved-elsewhere',
        content_hash: first.contentHash,
      }),
    ]);

    const second = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(second.reused).toBe(true);
    expect(createNode).not.toHaveBeenCalled();
  });

  it('ignores resources that are not articles', async () => {
    const created = stubCreateNode();
    vi.mocked(listNodes).mockResolvedValue([
      resourceNode({ resource_type: 'repo', id: 'resource.some-repo' }),
    ]);

    const result = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(result.reused).toBe(false);
    expect(created.map((node) => node.type)).toEqual(['source', 'resource']);
  });
});

describe('createArticleNodes — publication source reuse', () => {
  afterEach(() => vi.clearAllMocks());

  it('reuses an existing publication source without overwriting it', async () => {
    const created = stubCreateNode();
    vi.mocked(listNodes).mockImplementation(async (options) =>
      options?.type === 'source'
        ? [
            {
              id: 'signal-journal',
              type: 'source',
              title: 'Signal Journal (reviewed)',
              status: 'mature',
              tags: [],
              related: [],
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              body: '',
              source_kind: 'publication',
              platforms: ['website'],
              follow: false,
              profiles: [],
            } as unknown as LabNode,
          ]
        : [],
    );

    const result = await createArticleNodes({ url: ARTICLE_URL, fetchOptions: fetchOptions() });

    expect(created.map((node) => node.type)).toEqual(['resource']);
    expect(result.sourceId).toBe('signal-journal');
    expect(result.runTrace.stages[1]).toMatchObject({
      name: 'store:source',
      output: { id: 'signal-journal', reused: true },
    });
  });

  it('falls back to the hostname when the page declares no site name', async () => {
    const created = stubCreateNode();
    const html = `<!doctype html><html><head><title>No Site Name</title></head><body><article><h1>No Site Name</h1><p>${'This paragraph exists so the document clears the readable-article floor. '.repeat(6)}</p></article></body></html>`;

    await createArticleNodes({
      url: 'https://www.plain.example.com/a',
      fetchOptions: fetchOptions(htmlFetch(html)),
    });

    expect(created[0]).toMatchObject({ type: 'source', title: 'plain.example.com' });
  });
});

describe('createArticleNodes — failure', () => {
  afterEach(() => vi.clearAllMocks());

  it('throws a typed error and writes no nodes when the fetch fails', async () => {
    stubCreateNode();

    await expect(
      createArticleNodes({
        url: ARTICLE_URL,
        fetchOptions: fetchOptions(
          (async () =>
            new Response('nope', {
              status: 404,
              headers: { 'content-type': 'text/html' },
            })) as unknown as typeof fetch,
        ),
      }),
    ).rejects.toBeInstanceOf(ArticleFetchError);

    expect(createNode).not.toHaveBeenCalled();
    expect(updateNode).not.toHaveBeenCalled();
  });

  it('throws with the failure code when the page has no readable article', async () => {
    stubCreateNode();

    const error = await createArticleNodes({
      url: 'https://spa.example.com/',
      fetchOptions: fetchOptions(htmlFetch(readArticleFixture('noReadableArticle'))),
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ArticleFetchError);
    expect((error as ArticleFetchError).code).toBe('not_readable');
    expect(createNode).not.toHaveBeenCalled();
  });

  it('leaves no partial nodes when the target is blocked', async () => {
    stubCreateNode();

    await expect(
      createArticleNodes({ url: 'http://127.0.0.1/admin', fetchOptions: fetchOptions() }),
    ).rejects.toBeInstanceOf(ArticleFetchError);

    expect(createNode).not.toHaveBeenCalled();
  });
});
