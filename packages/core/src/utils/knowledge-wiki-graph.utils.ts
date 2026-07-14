import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { KnowledgeWikiPage, WikiLink } from '@llaab/schemas';

import { KNOWLEDGE_ROOT } from './knowledge-root.js';
import { listKnowledgeWikis } from './knowledge-wiki-file.utils.js';

export interface KnowledgeWikiGraph {
  nodes: Array<{ id: string; title: string }>;
  edges: Array<{ source: string; target: string; relation: string }>;
  reverse_edges: Array<{ source: string; target: string; relation: string }>;
  diagnostics: string[];
}

export interface KnowledgeWikiGraphFilter {
  lifecycle?: KnowledgeWikiPage['status'];
  q?: string;
  tag?: string;
  verification?: KnowledgeWikiPage['verification_status'];
}

const GRAPH_EXPORT_DIR = 'knowledge-graphs';
const GRAPH_EXPORT_FILE = 'wiki-graph.json';

function filterKnowledgeWikiPages(
  pages: KnowledgeWikiPage[],
  filter: KnowledgeWikiGraphFilter = {},
): KnowledgeWikiPage[] {
  const query = filter.q?.toLowerCase();
  return pages
    .filter((page) => (filter.lifecycle ? page.status === filter.lifecycle : true))
    .filter((page) => (filter.tag ? page.tags.includes(filter.tag) : true))
    .filter((page) => (filter.verification ? page.verification_status === filter.verification : true))
    .filter((page) => {
      if (!query) return true;
      const haystack =
        `${page.title} ${page.summary} ${page.topic_key} ${page.aliases.join(' ')}`.toLowerCase();
      return haystack.includes(query);
    });
}

function linkKey(sourceWikiId: string, link: WikiLink): string {
  return `${sourceWikiId}:${link.relation}:${link.target_wiki_id}`;
}

function validateLinkEvidenceNote(sourceWikiId: string, link: WikiLink, diagnostics: string[]): void {
  const note = link.note?.trim();
  if (!note) {
    diagnostics.push(`Missing link evidence note: ${sourceWikiId} -> ${link.target_wiki_id}`);
    return;
  }
  if (/^d:[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(note)) {
    diagnostics.push(`Link evidence cannot be only a domain tag: ${sourceWikiId} -> ${link.target_wiki_id}`);
  }
}

export function buildKnowledgeWikiGraphFromPages(pages: KnowledgeWikiPage[]): KnowledgeWikiGraph {
  const ids = new Set(pages.map((page) => page.id));
  const edges: KnowledgeWikiGraph['edges'] = [];
  const diagnostics: string[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const link of page.links) {
      const edgeKey = linkKey(page.id, link);
      validateLinkEvidenceNote(page.id, link, diagnostics);
      if (link.target_wiki_id === page.id) diagnostics.push(`Self link: ${page.id}`);
      else if (!ids.has(link.target_wiki_id))
        {diagnostics.push(`Broken link: ${page.id} -> ${link.target_wiki_id}`);}
      else if (seen.has(edgeKey)) diagnostics.push(`Duplicate link: ${edgeKey}`);
      else {
        seen.add(edgeKey);
        edges.push({ source: page.id, target: link.target_wiki_id, relation: link.relation });
      }
    }
  }
  edges.sort((left, right) =>
    `${left.source}:${left.relation}:${left.target}`.localeCompare(
      `${right.source}:${right.relation}:${right.target}`,
    ),
  );
  return {
    nodes: pages
      .map((page) => ({ id: page.id, title: page.title }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges,
    reverse_edges: edges
      .map((edge) => ({ source: edge.target, target: edge.source, relation: edge.relation }))
      .sort((left, right) =>
        `${left.source}:${left.relation}:${left.target}`.localeCompare(
          `${right.source}:${right.relation}:${right.target}`,
        ),
      ),
    diagnostics: diagnostics.sort(),
  };
}

export async function buildKnowledgeWikiGraph(
  filter: KnowledgeWikiGraphFilter = {},
): Promise<KnowledgeWikiGraph> {
  return buildKnowledgeWikiGraphFromPages(filterKnowledgeWikiPages(await listKnowledgeWikis(), filter));
}

export function assertValidKnowledgeWikiLinks(
  sourceWikiId: string,
  links: WikiLink[],
  promotedWikiIds: Iterable<string>,
): void {
  const promotedIds = new Set(promotedWikiIds);
  const graph = buildKnowledgeWikiGraphFromPages([
    {
      id: sourceWikiId,
      type: 'wiki',
      topic_key: sourceWikiId,
      title: sourceWikiId,
      aliases: [],
      summary: '',
      body: '',
      status: 'seed',
      tags: [],
      links,
      source_refs: [],
      source_canonical_idea_ids: [],
      source_transcript_ids: [],
      revision: 1,
      created_at: '2026-07-13T00:00:00Z',
      updated_at: '2026-07-13T00:00:00Z',
      verification_status: 'source-backed',
    },
    ...[...promotedIds]
      .filter((id) => id !== sourceWikiId)
      .map((id) => ({
        id,
        type: 'wiki' as const,
        topic_key: id,
        title: id,
        aliases: [],
        summary: '',
        body: '',
        status: 'seed' as const,
        tags: [],
        links: [],
        source_refs: [],
        source_canonical_idea_ids: [],
        source_transcript_ids: [],
        revision: 1,
        created_at: '2026-07-13T00:00:00Z',
        updated_at: '2026-07-13T00:00:00Z',
        verification_status: 'source-backed' as const,
      })),
  ]);
  if (graph.diagnostics.length > 0) throw new Error(graph.diagnostics[0]);
}

export async function exportKnowledgeWikiGraph(
  filter: KnowledgeWikiGraphFilter = {},
): Promise<{ path: string; graph: KnowledgeWikiGraph }> {
  const graph = await buildKnowledgeWikiGraph(filter);
  const exportDirectory = resolve(KNOWLEDGE_ROOT, GRAPH_EXPORT_DIR);
  const exportPath = resolve(exportDirectory, GRAPH_EXPORT_FILE);
  await mkdir(exportDirectory, { recursive: true });
  await writeFile(exportPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf-8');
  return { path: exportPath, graph };
}
