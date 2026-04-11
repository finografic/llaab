import { nodeSchemaByType } from '@llaab/schemas';
import type { LabNode } from '@llaab/schemas';

import { readNode } from './read-node.utils.js';
import { writeNode } from './write-node.utils.js';

export async function updateNode(
  filePath: string,
  updater: (current: LabNode) => LabNode,
): Promise<{ path: string; node: LabNode }> {
  const currentNode = await readNode(filePath);
  const nextNode = updater(currentNode);
  const validatedNode = nodeSchemaByType[currentNode.type].parse({
    ...nextNode,
    id: currentNode.id,
    type: currentNode.type,
  }) as LabNode;

  return writeNode(validatedNode);
}
