/**
 * Save-first article ingestion.
 *
 * The article and its publication source are persisted before any LLM call, so a failed extraction
 * still leaves a readable, searchable, retryable, discardable article behind.
 */

import { autoTag, createNode, getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { formatIsoUtcForTranscriptBody, now, toNodeId } from '@llaab/schemas';
import type { ExtractionRunTrace } from '../extract/llm-extract.js';
import type { FetchArticleOptions, FetchedArticle } from '../fetch/article/index.js';
import type { ResourceNode, SourceNode } from '@llaab/schemas';

import { fetchArticle, publicationOrigin } from '../fetch/article/index.js';

export interface ArticleIngestionInput {
  url: string;
  /** Operator override; when absent the fetched article title is used. */
  title?: string;
  tags?: string[];
  /** Pre-parsed article content, used for trusted pasted web clips that must not be re-fetched. */
  providedArticle?: FetchedArticle;
  providedArticleTags?: string[];
  /** Inbox capture that triggered this ingest, related to the article for provenance. */
  inboxCaptureId?: string;
  fetchOptions?: FetchArticleOptions;
}

export interface ArticleIngestionResult {
  id: string;
  path: string;
  type: 'resource';
  title: string;
  sourceId: string;
  sourceUrl: string;
  canonicalUrl: string;
  contentHash: string;
  author?: string;
  plainText: string;
  producedNodeIds: string[];
  reused: boolean;
  runTrace: ExtractionRunTrace;
}

/** Typed error carrying the fetch failure code so callers can map it to a run event. */
export class ArticleFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestedUrl: string,
    readonly finalUrl?: string,
  ) {
    super(message);
    this.name = 'ArticleFetchError';
  }
}

function completedStage(
  name: string,
  input?: unknown,
  output?: unknown,
): ExtractionRunTrace['stages'][number] {
  return { name, status: 'completed', input, output };
}

/** Human-readable header stored above the article body. */
function articleVisibleHeader(article: FetchedArticle, fetchedIsoUtc: string): string {
  const lines = [`[**${article.canonicalUrl}**](${article.canonicalUrl})`];

  if (article.byline) lines.push(`**author:** ${article.byline}`);
  if (article.siteName) lines.push(`**publication:** ${article.siteName}`);
  if (article.publishedAt) {
    lines.push(`**published:** ${formatIsoUtcForTranscriptBody(article.publishedAt)}`);
  }
  lines.push(`**fetched:** ${formatIsoUtcForTranscriptBody(fetchedIsoUtc)}`);

  return lines.join('\n');
}

function articleBody(title: string, article: FetchedArticle, fetchedIsoUtc: string): string {
  const heading = `# ${title
    .replace(/\r?\n/g, ' ')
    .replace(/^#+\s*/, '')
    .trim()}`;
  return `${heading}\n\n${articleVisibleHeader(article, fetchedIsoUtc)}\n\n## Article\n\n${article.markdown}`;
}

/** Finds an already-ingested article for the same canonical URL, or the same content hash. */
async function findExistingArticle(
  canonicalUrl: string,
  contentHash: string,
): Promise<ResourceNode | undefined> {
  const nodes = await listNodes({ type: 'resource' });

  return nodes.find(
    (node): node is ResourceNode =>
      node.type === 'resource' &&
      node.resource_type === 'article' &&
      (node.url === canonicalUrl || (Boolean(node.content_hash) && node.content_hash === contentHash)),
  );
}

/**
 * Creates the publication source, or reuses one that already exists for the same site.
 *
 * Reuse must never overwrite richer reviewed metadata, so an existing source is only appended to.
 */
async function createOrReusePublicationSource(
  article: FetchedArticle,
): Promise<{ sourceId: string; reused: boolean }> {
  const origin = publicationOrigin(article.canonicalUrl);
  const hostname = (() => {
    try {
      return new URL(article.canonicalUrl).hostname.replace(/^www\./, '');
    } catch {
      return origin;
    }
  })();

  const title = article.siteName ?? hostname;
  const sourceId = toNodeId(title);

  const existing = (await listNodes({ type: 'source' })).find(
    (node): node is SourceNode => node.type === 'source' && node.id === sourceId,
  );

  if (existing) return { sourceId, reused: true };

  await createNode({
    id: sourceId,
    type: 'source',
    title,
    tags: [],
    extra: {
      source_kind: 'publication',
      url: origin,
      platforms: ['website'],
      profiles: [{ platform: 'website', url: origin, label: title, primary: true }],
    },
  });

  return { sourceId, reused: false };
}

/** Adds `articleId` to the publication source's `related` list without disturbing other fields. */
async function relateArticleToSource(sourceId: string, articleId: string): Promise<void> {
  await updateNode(getNodeFilePath('source', sourceId), (node) => {
    const related = new Set([...(node.related ?? []), articleId]);
    return { ...node, related: [...related], updated_at: now() };
  });
}

/**
 * Fetches, deduplicates, and durably saves one article plus its publication source.
 *
 * Returns before any extraction runs. Extraction is the caller's separate, best-effort step.
 */
export async function createArticleNodes(input: ArticleIngestionInput): Promise<ArticleIngestionResult> {
  let fetched: FetchedArticle;

  if (input.providedArticle) {
    fetched = input.providedArticle;
  } else {
    const fetchedResult = await fetchArticle(input.url, input.fetchOptions ?? {});

    if (!fetchedResult.ok) {
      throw new ArticleFetchError(
        fetchedResult.code,
        fetchedResult.message,
        fetchedResult.requestedUrl,
        fetchedResult.finalUrl,
      );
    }

    fetched = fetchedResult;
  }

  const stages: ExtractionRunTrace['stages'] = [
    completedStage(
      input.providedArticle ? 'parse:obsidian-web-clip' : 'fetch:article',
      { url: input.url },
      {
        title: fetched.title,
        finalUrl: fetched.finalUrl,
        canonicalUrl: fetched.canonicalUrl,
        siteName: fetched.siteName,
        truncated: fetched.truncated,
        markdownLength: fetched.markdown.length,
      },
    ),
  ];

  const existing = await findExistingArticle(fetched.canonicalUrl, fetched.contentHash);

  if (existing) {
    const path = getNodeFilePath('resource', existing.id);
    stages.push(
      completedStage(
        'dedupe:article',
        {
          canonicalUrl: fetched.canonicalUrl,
          contentHash: fetched.contentHash,
        },
        { id: existing.id, path, reused: true },
      ),
    );

    return {
      id: existing.id,
      path,
      type: 'resource',
      title: existing.title,
      sourceId: existing.source_id ?? '',
      sourceUrl: existing.url ?? fetched.canonicalUrl,
      canonicalUrl: existing.url ?? fetched.canonicalUrl,
      contentHash: existing.content_hash ?? fetched.contentHash,
      ...(existing.author ? { author: existing.author } : {}),
      plainText: existing.body,
      producedNodeIds: [existing.id],
      reused: true,
      runTrace: {
        stages,
        decisions: [
          {
            type: 'accept',
            reason: `Existing article reused for canonical URL "${fetched.canonicalUrl}".`,
          },
        ],
      },
    };
  }

  const { sourceId, reused: sourceReused } = await createOrReusePublicationSource(fetched);
  stages.push(completedStage('store:source', { id: sourceId }, { id: sourceId, reused: sourceReused }));

  const title = input.title?.trim() || fetched.title;
  const fetchedAt = now();

  const created = await createNode({
    type: 'resource',
    title,
    body: articleBody(title, fetched, fetchedAt),
    tags: [
      ...new Set([
        'd:ingest',
        ...autoTag(title, fetched.plainText),
        ...(input.providedArticleTags ?? []),
        ...(input.tags ?? []),
      ]),
    ],
    extra: {
      resource_type: 'article',
      url: fetched.canonicalUrl,
      requested_url: fetched.requestedUrl,
      source_id: sourceId,
      ...(fetched.excerpt ? { description: fetched.excerpt } : {}),
      ...(fetched.byline ? { author: fetched.byline } : {}),
      ...(fetched.siteName ? { site_name: fetched.siteName } : {}),
      ...(fetched.publishedAt ? { source_published_at: fetched.publishedAt } : {}),
      fetched_at: fetchedAt,
      content_hash: fetched.contentHash,
      content_truncated: fetched.truncated,
      ...(input.inboxCaptureId ? { related: [input.inboxCaptureId] } : {}),
    },
  });

  stages.push(
    completedStage('store:article', { type: 'resource', sourceId }, { id: created.id, path: created.path }),
  );

  await relateArticleToSource(sourceId, created.id);

  return {
    id: created.id,
    path: created.path,
    type: 'resource',
    title,
    sourceId,
    sourceUrl: fetched.canonicalUrl,
    canonicalUrl: fetched.canonicalUrl,
    contentHash: fetched.contentHash,
    ...(fetched.byline ? { author: fetched.byline } : {}),
    plainText: fetched.plainText,
    producedNodeIds: [created.id, sourceId],
    reused: false,
    runTrace: { stages, decisions: [] },
  };
}
