import { describe, expect, it } from 'vitest';
import type { RunNode } from '@llaab/schemas';

import { getRunDisplayStatus, isIngestRun, isRunExtracting } from './run-display.utils';

function makeRun(overrides: Partial<RunNode> = {}): RunNode {
  return {
    id: 'run.demo',
    type: 'run',
    title: 'Demo run',
    status: 'mature',
    tags: ['run'],
    related: [],
    created_at: '2026-07-28T00:00:00Z',
    updated_at: '2026-07-28T00:00:00Z',
    body: '',
    skill_id: 'ingest-youtube',
    run_status: 'completed',
    produced_node_ids: ['transcript.one'],
    events: [],
    decisions: [],
    ...overrides,
  } as unknown as RunNode;
}

describe('isIngestRun', () => {
  it('includes article runs so they appear in the runs table', () => {
    expect(isIngestRun(makeRun({ skill_id: 'ingest-article' }))).toBe(true);
    expect(isIngestRun(makeRun({ skill_id: 'ingest-youtube' }))).toBe(true);
    expect(isIngestRun(makeRun({ skill_id: 'ingest-podcast' }))).toBe(true);
  });

  it('excludes non-ingest skills', () => {
    expect(isIngestRun(makeRun({ skill_id: 'consolidate-canonical-ideas' }))).toBe(false);
    expect(isIngestRun(makeRun({ skill_id: undefined }))).toBe(false);
  });
});

describe('isRunExtracting', () => {
  it('reports a transcript run awaiting client-side extraction', () => {
    expect(isRunExtracting(makeRun())).toBe(true);
  });

  it('never reports an article run as extracting, since it extracts inside the skill', () => {
    const articleRun = makeRun({
      skill_id: 'ingest-article',
      produced_node_ids: ['resource.one'],
    });

    expect(isRunExtracting(articleRun)).toBe(false);
    expect(getRunDisplayStatus(articleRun)).toBe('completed');
  });

  it('stops reporting extraction once ideas and an LLM trace are attached', () => {
    expect(isRunExtracting(makeRun({ produced_node_ids: ['transcript.one', 'idea.one'] }))).toBe(false);
  });

  it('stops reporting extraction after an extraction failure event', () => {
    expect(
      isRunExtracting(
        makeRun({
          events: [
            {
              id: 'e1',
              at: '2026-07-28T00:00:01Z',
              level: 'warning',
              message: 'Extraction failed (transcript saved): LLM unavailable',
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
