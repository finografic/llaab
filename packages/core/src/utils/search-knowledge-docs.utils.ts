import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { KNOWLEDGE_ROOT } from './knowledge-root.js';
import { parseFrontmatter } from './parse-frontmatter.utils.js';
import { buildTextSnippet, tokenizeSearchQuery } from './search-vault-nodes.utils.js';

export interface KnowledgeDocSearchQuery {
  query: string;
  collection?: string;
  limit?: number;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  /** Path relative to `KNOWLEDGE_ROOT`, e.g. `wikis/context-management.md`. */
  path: string;
  /** Top-level folder inside `knowledge/`, e.g. `wikis`. */
  collection: string;
  tags: string[];
  body: string;
}

export interface KnowledgeDocSearchResult extends KnowledgeDoc {
  score: number;
  snippet: string;
  /** Client route when the collection is browsable, otherwise undefined. */
  href?: string;
}

const TITLE_MATCH_SCORE = 100;
const TAG_MATCH_SCORE = 60;
const BODY_MATCH_SCORE = 20;
const EXACT_TITLE_BONUS = 40;
const IGNORED_DIRECTORY_NAMES = new Set(['node_modules', 'dist']);

export async function searchKnowledgeDocs(
  query: KnowledgeDocSearchQuery,
): Promise<KnowledgeDocSearchResult[]> {
  const docs = await listKnowledgeDocs(query.collection);
  return rankKnowledgeDocs(docs, query);
}

export async function listKnowledgeDocs(collection?: string): Promise<KnowledgeDoc[]> {
  const root = collection ? join(KNOWLEDGE_ROOT, collection) : KNOWLEDGE_ROOT;
  const files = await listMarkdownFiles(root);

  const docs = await Promise.all(files.map((filePath) => readKnowledgeDoc(filePath)));
  return docs.filter((doc): doc is KnowledgeDoc => doc !== null);
}

export function rankKnowledgeDocs(
  docs: KnowledgeDoc[],
  query: KnowledgeDocSearchQuery,
): KnowledgeDocSearchResult[] {
  const searchTerms = tokenizeSearchQuery(query.query);
  if (searchTerms.length === 0) return [];

  return docs
    .map((doc) => rankKnowledgeDoc(doc, searchTerms, query.query))
    .filter((result): result is KnowledgeDocSearchResult => result !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, query.limit ?? Number.POSITIVE_INFINITY);
}

export function getKnowledgeDocHref(doc: Pick<KnowledgeDoc, 'collection' | 'id'>): string | undefined {
  if (doc.collection === 'wikis') return `/knowledge/wikis/${doc.id}`;
  return undefined;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || IGNORED_DIRECTORY_NAMES.has(entry.name)) return [];
        return listMarkdownFiles(entryPath);
      }
      return entry.name.endsWith('.md') ? [entryPath] : [];
    }),
  );

  return nested.flat();
}

async function readKnowledgeDoc(filePath: string): Promise<KnowledgeDoc | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const { frontmatter, body } = parseKnowledgeDocContent(content);
  const relativePath = relative(KNOWLEDGE_ROOT, filePath).split(sep).join('/');
  const id = relativePath.replace(/\.md$/, '').split('/').at(-1) ?? relativePath;

  return {
    body,
    collection: relativePath.includes('/') ? (relativePath.split('/')[0] ?? '') : '',
    id: readStringField(frontmatter['id']) ?? id,
    path: relativePath,
    tags: readTags(frontmatter['tags']),
    title: readStringField(frontmatter['title']) ?? readHeadingTitle(body) ?? id,
  };
}

function parseKnowledgeDocContent(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  try {
    const parsed = parseFrontmatter(content);
    return { body: parsed.body, frontmatter: parsed.frontmatter };
  } catch {
    return { body: content.trim(), frontmatter: {} };
  }
}

function readStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === 'string');
}

function readHeadingTitle(body: string): string | undefined {
  return /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
}

function rankKnowledgeDoc(
  doc: KnowledgeDoc,
  searchTerms: string[],
  rawQuery: string,
): KnowledgeDocSearchResult | null {
  const title = doc.title.toLowerCase();
  const body = doc.body.toLowerCase();
  let score = 0;

  for (const term of searchTerms) {
    if (title.includes(term)) score += TITLE_MATCH_SCORE;
    if (doc.tags.some((tag) => tag.toLowerCase().includes(term))) score += TAG_MATCH_SCORE;
    if (body.includes(term)) score += BODY_MATCH_SCORE;
  }

  if (score === 0) return null;
  if (title === rawQuery.trim().toLowerCase()) score += EXACT_TITLE_BONUS;

  return {
    ...doc,
    href: getKnowledgeDocHref(doc),
    score,
    snippet: buildTextSnippet(doc.body, doc.title, searchTerms),
  };
}
