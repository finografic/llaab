import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { KnowledgeWikiPageSchema, NodeIdSchema } from '@llaab/schemas';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { KNOWLEDGE_ROOT } from './knowledge-root.js';
import { markdownWithFrontmatter } from './markdown-frontmatter.utils.js';
import { parseFrontmatter } from './parse-frontmatter.utils.js';

const WIKI_DIR = 'wikis';
const WIKI_DOC_FILENAMES = new Set(['README.md']);
const WIKI_FRONTMATTER_ORDER = [
  'id',
  'type',
  'topic_key',
  'title',
  'aliases',
  'summary',
  'status',
  'tags',
  'links',
  'source_refs',
  'source_canonical_idea_ids',
  'source_transcript_ids',
  'revision',
  'created_at',
  'updated_at',
  'reviewed_at',
  'verification_status',
  'quality_score',
  'generation_provider',
  'generation_model',
  'generation_duration_ms',
];

const wikiLocks = new Map<string, Promise<void>>();
const WIKI_SECTION_MARKER = /<!--\s*wiki-section:([a-z0-9]+(?:[-_][a-z0-9]+)*)\s*-->/g;
const WIKI_CITATION = /\[\^([a-z0-9]+(?:[-_][a-z0-9]+)*)\]/g;
const TIMESTAMP_LOCATOR = /^(?:\d+:)?[0-5]?\d:[0-5]\d$/;
const PARAGRAPH_LOCATOR = /^p:[1-9]\d*$/;

function validateSourceLocator(locator: string | undefined, url: string | undefined): void {
  if (!locator) return;
  const isTimestamp = TIMESTAMP_LOCATOR.test(locator);
  if (!isTimestamp && !PARAGRAPH_LOCATOR.test(locator)) {
    throw new Error(`Knowledge wiki has malformed source locator: ${locator}`);
  }
  if (!url) return;
  const parsed = new URL(url);
  const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(parsed.hostname);
  if (isTimestamp && isYouTube && !parsed.searchParams.has('t')) {
    throw new Error(`YouTube source reference with locator must include a t= deep link: ${locator}`);
  }
}

function assertContained(root: string, target: string): void {
  const pathFromRoot = relative(root, target);
  if (pathFromRoot === '' || (!pathFromRoot.startsWith('..') && !pathFromRoot.includes(`..${'/'}`))) return;
  throw new Error(`Knowledge wiki path escapes the configured root: ${target}`);
}

function wikiFilename(id: string): string {
  return `${NodeIdSchema.parse(id)}.md`;
}

export function getKnowledgeWikiPath(id: string): string {
  const wikiPath = resolve(KNOWLEDGE_ROOT, WIKI_DIR, wikiFilename(id));
  const wikiDirectory = resolve(KNOWLEDGE_ROOT, WIKI_DIR);
  assertContained(wikiDirectory, wikiPath);
  return wikiPath;
}

async function ensureKnowledgeWikiDirectory(): Promise<string> {
  const rootPath = resolve(KNOWLEDGE_ROOT);
  const wikiDirectory = resolve(rootPath, WIKI_DIR);
  await mkdir(wikiDirectory, { recursive: true });

  const [realRoot, realWikiDirectory] = await Promise.all([realpath(rootPath), realpath(wikiDirectory)]);
  assertContained(realRoot, realWikiDirectory);
  return realWikiDirectory;
}

async function resolveSafeWikiPath(id: string, requireExisting: boolean): Promise<string> {
  const wikiDirectory = await ensureKnowledgeWikiDirectory();
  const filePath = resolve(wikiDirectory, wikiFilename(id));
  assertContained(wikiDirectory, filePath);

  if (!requireExisting) return filePath;

  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`Knowledge wiki must be a regular file: ${basename(filePath)}`);
  }

  const realFilePath = await realpath(filePath);
  assertContained(wikiDirectory, realFilePath);
  return realFilePath;
}

export function knowledgeWikiToMarkdown(page: KnowledgeWikiPage): string {
  const validatedPage = validateKnowledgeWikiPage(page);
  const { body, ...frontmatter } = validatedPage;
  return markdownWithFrontmatter(frontmatter, body, WIKI_FRONTMATTER_ORDER);
}

export function getKnowledgeWikiSectionIds(body: string): string[] {
  const sectionIds = [...body.matchAll(WIKI_SECTION_MARKER)].map((match) => NodeIdSchema.parse(match[1]));
  if (new Set(sectionIds).size !== sectionIds.length) {
    throw new Error('Knowledge wiki contains duplicate stable section ids.');
  }
  return sectionIds;
}

export function renderKnowledgeWikiCitation(sourceRefId: string): string {
  return `[^${NodeIdSchema.parse(sourceRefId)}]`;
}

export function validateKnowledgeWikiPage(page: KnowledgeWikiPage): KnowledgeWikiPage {
  const validatedPage = KnowledgeWikiPageSchema.parse(page);
  const sectionIds = getKnowledgeWikiSectionIds(validatedPage.body);
  if (validatedPage.body.trim().length > 0 && sectionIds.length === 0) {
    throw new Error('Knowledge wiki body must contain stable wiki-section markers.');
  }

  const sourceRefIds = new Set(validatedPage.source_refs.map((sourceRef) => sourceRef.id));
  if (sourceRefIds.size !== validatedPage.source_refs.length) {
    throw new Error('Knowledge wiki contains duplicate source reference ids.');
  }
  for (const sourceRef of validatedPage.source_refs) validateSourceLocator(sourceRef.locator, sourceRef.url);
  for (const citation of validatedPage.body.matchAll(WIKI_CITATION)) {
    const citationId = NodeIdSchema.parse(citation[1]);
    if (!sourceRefIds.has(citationId)) {
      throw new Error(`Knowledge wiki citation does not resolve to a source reference: ${citationId}`);
    }
  }
  const sectionStarts = [...validatedPage.body.matchAll(WIKI_SECTION_MARKER)];
  for (const [index, section] of sectionStarts.entries()) {
    const sectionBody = validatedPage.body.slice(section.index, sectionStarts[index + 1]?.index);
    if (!WIKI_CITATION.test(sectionBody)) {
      throw new Error(`Knowledge wiki section lacks a resolvable citation: ${section[1]}`);
    }
    WIKI_CITATION.lastIndex = 0;
  }

  return validatedPage;
}

export function hashKnowledgeWikiPage(page: KnowledgeWikiPage): string {
  return createHash('sha256').update(knowledgeWikiToMarkdown(page)).digest('hex');
}

export async function readKnowledgeWiki(id: string): Promise<KnowledgeWikiPage> {
  const filePath = await resolveSafeWikiPath(id, true);
  const content = await readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content, filePath);
  return validateKnowledgeWikiPage(KnowledgeWikiPageSchema.parse({ ...frontmatter, body }));
}

export async function listKnowledgeWikis(): Promise<KnowledgeWikiPage[]> {
  const wikiDirectory = await ensureKnowledgeWikiDirectory();
  const entries = await readdir(wikiDirectory, { withFileTypes: true });
  const symlink = entries.find((entry) => entry.isSymbolicLink());
  if (symlink) throw new Error(`Knowledge wiki directory cannot contain symbolic links: ${symlink.name}`);
  const wikiIds = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !WIKI_DOC_FILENAMES.has(entry.name))
    .map((entry) => entry.name.slice(0, -'.md'.length))
    .sort();

  return Promise.all(wikiIds.map((id) => readKnowledgeWiki(id)));
}

export async function writeKnowledgeWiki(
  page: KnowledgeWikiPage,
): Promise<{ path: string; page: KnowledgeWikiPage }> {
  const validatedPage = validateKnowledgeWikiPage(page);
  const filePath = await resolveSafeWikiPath(validatedPage.id, false);
  const existingStats = await lstat(filePath).catch((error: unknown) => {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  });
  if (existingStats?.isSymbolicLink()) {
    throw new Error(`Refusing to replace symbolic-link knowledge wiki: ${basename(filePath)}`);
  }

  const temporaryPath = join(
    await ensureKnowledgeWikiDirectory(),
    `.${validatedPage.id}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, knowledgeWikiToMarkdown(validatedPage), 'utf-8');
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }

  return { path: filePath, page: validatedPage };
}

export async function withKnowledgeWikiLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const lockId = NodeIdSchema.parse(id);
  const previous = wikiLocks.get(lockId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolveCurrent) => {
    releaseCurrent = resolveCurrent;
  });
  const queued = previous.then(() => current);
  wikiLocks.set(lockId, queued);

  await previous;
  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (wikiLocks.get(lockId) === queued) wikiLocks.delete(lockId);
  }
}
