import { describe, expect, it } from 'vitest';
import type { RunNode, TranscriptNode } from '@llaab/schemas';

import { groupRunsBySubject } from './run-grouping.utils.js';

describe('groupRunsBySubject', () => {
  it('falls back to transcript source_published_at for reused transcript runs', () => {
    const run = {
      id: 'ingest-youtube-run_2026-06-20T12-20-30',
      type: 'run',
      title: 'ingest-youtube run 2026-06-20 12:20:30',
      body: '',
      status: 'mature',
      tags: ['run', 'ingest-youtube'],
      related: [],
      created_at: '2026-06-20T12:20:30Z',
      updated_at: '2026-06-20T12:20:30Z',
      skill_id: 'ingest-youtube',
      run_status: 'completed',
      input_summary: '{"url":"https://www.youtube.com/watch?v=iJVJwmCKW9o"}',
      output_summary:
        '{"id":"i-guess-were-writing-loops-now","type":"transcript","title":"I guess we\\u0027re writing loops now?","sourceId":"theo-t3-gg"}',
      produced_node_ids: ['i-guess-were-writing-loops-now'],
      stages: [
        {
          name: 'dedupe:transcript',
          status: 'completed',
          output: {
            id: 'i-guess-were-writing-loops-now',
            reused: true,
          },
        },
      ],
      decisions: [],
      events: [],
    } satisfies RunNode;

    const transcript = {
      id: 'i-guess-were-writing-loops-now',
      type: 'transcript',
      title: "I guess we're writing loops now?",
      body: '',
      status: 'seed',
      tags: [],
      related: [],
      created_at: '2026-06-20T12:11:33Z',
      updated_at: '2026-06-20T12:21:31Z',
      source_url: 'https://www.youtube.com/watch?v=iJVJwmCKW9o',
      source_type: 'youtube',
      source_published_at: '2026-06-18T19:21:20Z',
      extracted_idea_ids: [],
      extracted_skill_ids: [],
    } satisfies TranscriptNode;

    const [group] = groupRunsBySubject([run], new Map(), new Map([[transcript.id, transcript]]));

    expect(group?.publishedAt).toBe('2026-06-18T19:21:20Z');
  });
});
