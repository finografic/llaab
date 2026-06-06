import { unlink } from 'node:fs/promises';
import type { NodeType } from '@llaab/schemas';

import { getNodeFilePath } from './node-file.utils.js';

export async function deleteNode(type: NodeType, id: string): Promise<void> {
  await unlink(getNodeFilePath(type, id));
}
