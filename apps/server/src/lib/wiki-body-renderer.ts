import type { WikiSourceRef } from '@llaab/schemas';

import { renderReadmeToHtml } from './readme-renderer.js';

const WIKI_SECTION_COMMENT = /<!--\s*wiki-section:[^>]*-->/g;
const WIKI_SECTION_CAPTURE = /<!--\s*wiki-section:([a-z0-9]+(?:[-_][a-z0-9]+)*)\s*-->/g;
const CITATION_RE = /\[\^([^\]]+)\]/g;

export function sourceRefHref(ref: Pick<WikiSourceRef, 'id' | 'kind' | 'node_id' | 'url'>): string | null {
  if (ref.kind === 'transcript') {
    const nodeId = ref.node_id ?? ref.id;
    return `/vault/transcripts/${encodeURIComponent(nodeId)}`;
  }
  if (ref.kind === 'canonical-idea' || ref.kind === 'source') {
    const nodeId = ref.node_id ?? ref.id;
    return `/vault/nodes/${encodeURIComponent(nodeId)}`;
  }
  if (ref.url) return ref.url;
  return null;
}

/** Rewrite wiki draft markdown: strip section markers, turn [^ref] into numbered links. */
export function prepareWikiBodyMarkdown(
  markdown: string,
  sourceRefs: Array<Pick<WikiSourceRef, 'id' | 'kind' | 'node_id' | 'url' | 'title' | 'locator'>> = [],
): string {
  const refsById = new Map(sourceRefs.map((ref) => [ref.id, ref]));
  const citationOrder = new Map<string, number>();
  let next = 1;

  const withoutSections = markdown.replace(WIKI_SECTION_COMMENT, '').trim();

  return withoutSections.replace(CITATION_RE, (_match, rawId: string) => {
    const id = String(rawId);
    let n = citationOrder.get(id);
    if (n == null) {
      n = next;
      next += 1;
      citationOrder.set(id, n);
    }
    const ref = refsById.get(id);
    const href = ref ? sourceRefHref(ref) : null;
    const label = ref?.locator ? `${n}: ${ref.locator}` : String(n);
    const title = ref?.title ? `${ref.title}${ref.locator ? ` · ${ref.locator}` : ''}` : id;
    // Use HTML so citations stay superscript and links survive sanitization.
    if (!href) {
      return `<sup class="wiki-cite wiki-cite--unresolved" title="${escapeAttr(title)}">[${escapeHtml(label)}]</sup>`;
    }
    const external = href.startsWith('http://') || href.startsWith('https://');
    const rel = external ? ' target="_blank" rel="noreferrer"' : '';
    return `<sup class="wiki-cite"><a href="${escapeAttr(href)}" title="${escapeAttr(title)}"${rel}>[${escapeHtml(label)}]</a></sup>`;
  });
}

export async function renderWikiBodyToHtml(
  markdown: string,
  sourceRefs: Array<Pick<WikiSourceRef, 'id' | 'kind' | 'node_id' | 'url' | 'title' | 'locator'>> = [],
): Promise<string> {
  const prepared = prepareWikiBodyMarkdown(markdown, sourceRefs);
  return renderReadmeToHtml(prepared);
}

export interface RenderedWikiSection {
  id: string;
  heading: string;
  html: string;
}

export async function renderWikiSectionsToHtml(
  markdown: string,
  sourceRefs: Array<Pick<WikiSourceRef, 'id' | 'kind' | 'node_id' | 'url' | 'title' | 'locator'>> = [],
): Promise<RenderedWikiSection[]> {
  const matches = [...markdown.matchAll(WIKI_SECTION_CAPTURE)];
  return Promise.all(
    matches.map(async (match, index) => {
      const sectionMarkdown = markdown
        .slice(match.index! + match[0].length, matches[index + 1]?.index)
        .trim();
      const heading = sectionMarkdown.match(/^##\s+(.+)$/m)?.[1]?.trim() ?? match[1]!;
      return {
        id: match[1]!,
        heading,
        html: await renderWikiBodyToHtml(sectionMarkdown, sourceRefs),
      };
    }),
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
