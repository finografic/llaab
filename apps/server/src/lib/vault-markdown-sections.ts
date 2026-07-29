import { renderReadmeToHtml } from './readme-renderer.js';

export interface VaultMarkdownSection {
  id: string;
  heading: string;
  markdown: string;
  html: string;
}

interface RawVaultMarkdownSection {
  id: string;
  heading: string;
  markdown: string;
}

export type VaultMarkdownSplitLevel = 'h1' | 'h2';

const H1_PATTERN = /^#(?!#)\s+(.+)$/gmu;
const H2_PATTERN = /^##(?!#)\s+(.+)$/gmu;

function normalizeSectionId(heading: string, index: number): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return slug || `section-${index + 1}`;
}

function splitMarkdownByHeading(markdown: string, level: VaultMarkdownSplitLevel): RawVaultMarkdownSection[] {
  const pattern = level === 'h2' ? H2_PATTERN : H1_PATTERN;
  const matches = [...markdown.matchAll(pattern)];

  if (matches.length === 0) {
    return [
      {
        id: 'section-1',
        heading: 'Document',
        markdown,
      },
    ];
  }

  const sections: RawVaultMarkdownSection[] = [];
  const firstMatch = matches[0];
  const preamble = markdown.slice(0, firstMatch.index).trim();

  if (preamble) {
    sections.push({
      id: 'preamble',
      heading: 'Preamble',
      markdown: preamble,
    });
  }

  matches.forEach((match, index) => {
    const start = match.index;
    const next = matches[index + 1];
    const end = next?.index ?? markdown.length;
    const heading = match[1]?.trim() ?? `Section ${index + 1}`;
    const sectionMarkdown = markdown.slice(start, end).trim();

    if (!sectionMarkdown) return;

    sections.push({
      id: normalizeSectionId(heading, index),
      heading,
      markdown: sectionMarkdown,
    });
  });

  return sections;
}

export async function renderVaultMarkdownSections(
  markdown: string,
  level: VaultMarkdownSplitLevel = 'h1',
): Promise<VaultMarkdownSection[]> {
  const sections = splitMarkdownByHeading(markdown, level);

  return Promise.all(
    sections.map(async (section) => ({
      ...section,
      html: await renderReadmeToHtml(section.markdown),
    })),
  );
}
