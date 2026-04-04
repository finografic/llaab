import type { LabNode } from '@llaab/schemas';
import { NodeSchema } from '@llaab/schemas';
import { readFile } from 'fs/promises';

import { parseFrontmatter } from './parse-frontmatter.utils.js';

export async function readNode(filePath: string): Promise<LabNode> {
  const content = await readFile(filePath, 'utf-8');
  const { frontmatter, body } = parseFrontmatter(content, filePath);
  return NodeSchema.parse({ ...frontmatter, body });
}
