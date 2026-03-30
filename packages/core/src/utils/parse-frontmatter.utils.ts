import type { Frontmatter } from '@llaab/schemas';
import { FrontmatterSchema } from '@llaab/schemas';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseYamlLike(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const rawValue = line.slice(colonIndex + 1).trim();

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const inner = rawValue.slice(1, -1).trim();
      result[key] = inner ? inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')) : [];
    } else {
      result[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
  return result;
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    throw new Error('No frontmatter found in file');
  }
  const raw = parseYamlLike(match[1]);
  const frontmatter = FrontmatterSchema.parse(raw);
  const body = content.slice(match[0].length).trimStart();
  return { frontmatter, body };
}
