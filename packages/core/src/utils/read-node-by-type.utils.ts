import type { LabNode, NodeType } from '@llaab/schemas';

import { getNodeFilePath } from './node-file.utils.js';
import { readNode } from './read-node.utils.js';

export async function readNodeByType<T extends NodeType>(
  type: T,
  id: string,
): Promise<Extract<LabNode, { type: T }>> {
  const node = await readNode(getNodeFilePath(type, id));
  if (node.type !== type) {
    throw new Error(`Expected ${type} node at ${id}, found ${node.type}`);
  }
  return node as Extract<LabNode, { type: T }>;
}
