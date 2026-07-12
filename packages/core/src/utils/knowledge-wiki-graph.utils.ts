import { listKnowledgeWikis } from './knowledge-wiki-file.utils.js';

export interface KnowledgeWikiGraph {
  nodes: Array<{ id: string; title: string }>;
  edges: Array<{ source: string; target: string; relation: string }>;
  diagnostics: string[];
}

export async function buildKnowledgeWikiGraph(): Promise<KnowledgeWikiGraph> {
  const pages = await listKnowledgeWikis();
  const ids = new Set(pages.map((page) => page.id));
  const edges: KnowledgeWikiGraph['edges'] = [];
  const diagnostics: string[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    for (const link of page.links) {
      const edgeKey = `${page.id}:${link.relation}:${link.target_wiki_id}`;
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
  return { nodes: pages.map((page) => ({ id: page.id, title: page.title })), edges, diagnostics };
}
