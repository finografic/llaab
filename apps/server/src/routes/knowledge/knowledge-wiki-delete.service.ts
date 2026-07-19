import {
  deleteKnowledgeWiki,
  determineKnowledgeWikiLifecycle,
  listKnowledgeWikis,
  readKnowledgeWiki,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { KnowledgeWikiPage } from '@llaab/schemas';

export interface DeleteKnowledgeWikiResult {
  deletedWikiId: string;
  scrubbedReferences: Array<{ wikiId: string; removedLinks: number; revision: number }>;
}

function removeLinksToDeletedWiki(page: KnowledgeWikiPage, deletedWikiId: string): KnowledgeWikiPage | null {
  const links = page.links.filter((link) => link.target_wiki_id !== deletedWikiId);
  if (links.length === page.links.length) return null;
  const now = formatIsoUtcSeconds(new Date());
  const next: KnowledgeWikiPage = {
    ...page,
    links,
    revision: page.revision + 1,
    updated_at: now,
    reviewed_at: now,
  };
  return { ...next, status: determineKnowledgeWikiLifecycle(next) };
}

export async function deleteKnowledgeWikiAndReferences(wikiId: string): Promise<DeleteKnowledgeWikiResult> {
  return withKnowledgeWikiLock(wikiId, async () => {
    const target = await readKnowledgeWiki(wikiId);
    const pages = await listKnowledgeWikis();
    const scrubbedReferences: DeleteKnowledgeWikiResult['scrubbedReferences'] = [];

    for (const page of pages.filter((candidate) => candidate.id !== target.id)) {
      await withKnowledgeWikiLock(page.id, async () => {
        const current = await readKnowledgeWiki(page.id);
        const next = removeLinksToDeletedWiki(current, target.id);
        if (!next) return;
        const written = await writeKnowledgeWiki(next);
        scrubbedReferences.push({
          wikiId: written.page.id,
          removedLinks: current.links.length - written.page.links.length,
          revision: written.page.revision,
        });
      });
    }

    await deleteKnowledgeWiki(target.id);
    return { deletedWikiId: target.id, scrubbedReferences };
  });
}
