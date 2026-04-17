import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { nodeSchemaByType, now } from '@llaab/schemas';
import type { LabNode } from '@llaab/schemas';

import { getNodeFilePath, nodeToMarkdown } from './node-file.utils.js';

export async function writeNode(node: LabNode): Promise<{ path: string; node: LabNode }> {
  const validatedNode = nodeSchemaByType[node.type].parse({
    ...node,
    updated_at: now(),
  }) as LabNode;

  const filePath = getNodeFilePath(validatedNode.type, validatedNode.id);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, nodeToMarkdown(validatedNode), 'utf-8');

  return { path: filePath, node: validatedNode };
}
