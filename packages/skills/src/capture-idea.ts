import { createNode } from '@llaab/core';

export async function captureIdea(title: string, body?: string, tags?: string[]): Promise<void> {
  const { id, path } = await createNode({ type: 'idea', title, body, tags });
  console.log(`Idea captured: ${id}`);
  console.log(`  → ${path}`);
}
