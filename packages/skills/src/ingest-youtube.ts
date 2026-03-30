import { createNode } from '@llaab/core';

export interface IngestYouTubeInput {
  url: string;
  title: string;
  transcript?: string;
  tags?: string[];
}

export async function ingestYouTube(input: IngestYouTubeInput): Promise<void> {
  const body = input.transcript ? `## Transcript\n\n${input.transcript}` : '<!-- transcript pending -->';

  const { id, path } = await createNode({
    type: 'resource',
    title: input.title,
    body: `Source: ${input.url}\n\n${body}`,
    tags: input.tags,
  });

  console.log(`YouTube resource ingested: ${id}`);
  console.log(`  → ${path}`);
}
