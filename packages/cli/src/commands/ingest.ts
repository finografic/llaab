import { ingestYouTube } from '@llaab/skills';
import { defineCommand } from 'citty';

import { pc } from '../utils/picocolors.js';

export const ingestCommand = defineCommand({
  meta: {
    name: 'ingest',
    description: 'Ingest a YouTube video — fetch transcript and store vault nodes',
  },
  args: {
    url: {
      type: 'positional',
      description: 'YouTube URL',
      required: true,
    },
    title: {
      type: 'string',
      description: 'Override the video title',
    },
    tags: {
      type: 'string',
      description: 'Comma-separated tags (e.g. d:llm,d:automation)',
    },
  },
  async run({ args }) {
    const { url, title, tags } = args;
    const tagList = tags
      ? tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    console.log(pc.cyan(`Ingesting: ${url}`));
    if (tagList?.length) console.log(pc.gray(`Tags: ${tagList.join(', ')}`));

    let record, result;
    try {
      ({ record, result } = await ingestYouTube({ url, title, tags: tagList }));
    } catch (err) {
      console.error(pc.red('Ingestion failed.'));
      console.error(pc.gray(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }

    if (record.status === 'failed') {
      console.error(pc.red(`Skill failed: ${record.error ?? 'unknown error'}`));
      process.exit(1);
    }

    const reused = result.runTrace?.stages.some((s) => s.name === 'dedupe:transcript') ?? false;

    if (reused) {
      console.log(pc.yellow(`Already ingested — existing node reused`));
    } else {
      console.log(pc.green(`Saved`));
    }

    console.log(pc.gray(`  id:   ${result.id}`));
    console.log(pc.gray(`  type: ${result.type}`));
    console.log(pc.gray(`  path: ${result.path}`));
  },
});
