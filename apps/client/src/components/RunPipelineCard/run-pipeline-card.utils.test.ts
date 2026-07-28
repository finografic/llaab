import { describe, expect, it } from 'vitest';
import type { RunMonitorItem } from '@llaab/schemas';

import { buildIngestMonitorSteps } from './run-pipeline-card.utils';

function makeIngestRun(overrides: Partial<RunMonitorItem> = {}): RunMonitorItem {
  return {
    id: 'run.ingest-youtube-demo',
    title: 'Demo ingest',
    status: 'running',
    skill_id: 'ingest-youtube',
    produced_node_count: 0,
    run_link: {
      label: 'run.ingest-youtube-demo',
      href: '/vault/runs/run.ingest-youtube-demo',
    },
    steps: [
      {
        id: 'execute',
        title: 'execute',
        status: 'pending',
      },
    ],
    events: [],
    ...overrides,
  };
}

describe('buildIngestMonitorSteps', () => {
  it('keeps extraction pending while the transcript is still processing', () => {
    const steps = buildIngestMonitorSteps(makeIngestRun());

    expect(steps).toMatchObject([
      { id: 'transcript', status: 'active', title: 'Transcript processing' },
      { id: 'extraction', status: 'pending', title: 'Extraction pending' },
    ]);
  });

  it('marks extraction active once extraction has started', () => {
    const steps = buildIngestMonitorSteps(
      makeIngestRun({
        events: [
          {
            id: 'event.extracting',
            at: '2026-07-08T12:00:00Z',
            level: 'info',
            message: 'Extracting ideas from transcript',
          },
        ],
      }),
    );

    expect(steps).toMatchObject([
      { id: 'transcript', status: 'complete', title: 'Transcript saved' },
      { id: 'extraction', status: 'active', title: 'Extraction processing' },
    ]);
  });
});

describe('buildIngestMonitorSteps — article runs', () => {
  function makeArticleRun(overrides: Partial<RunMonitorItem> = {}): RunMonitorItem {
    return makeIngestRun({
      id: 'run.ingest-article-demo',
      skill_id: 'ingest-article',
      ...overrides,
    });
  }

  it('uses article wording rather than calling the resource a transcript', () => {
    const steps = buildIngestMonitorSteps(makeArticleRun(), 'Article');

    expect(steps).toMatchObject([
      { id: 'transcript', status: 'active', title: 'Article processing' },
      { id: 'extraction', status: 'pending', title: 'Extraction pending' },
    ]);
    // Step ids stay stable across source kinds; only the user-visible copy changes.
    expect(steps.map((step) => step.title).join(' ')).not.toMatch(/transcript/i);
  });

  it('reports a saved article once extraction starts', () => {
    const steps = buildIngestMonitorSteps(
      makeArticleRun({
        events: [
          {
            id: 'event.extracting',
            at: '2026-07-28T12:00:00Z',
            level: 'info',
            message: 'Extracting ideas from article',
          },
        ],
      }),
      'Article',
    );

    expect(steps[0]).toMatchObject({ status: 'complete', title: 'Article saved' });
  });

  it('reports a reused article', () => {
    const steps = buildIngestMonitorSteps(
      makeArticleRun({
        status: 'completed',
        events: [
          {
            id: 'event.reused',
            at: '2026-07-28T12:00:00Z',
            level: 'success',
            message: 'Reused existing article "Bounded Fetching"',
          },
        ],
      }),
      'Article',
    );

    expect(steps[0]).toMatchObject({ title: 'Article already saved' });
  });

  it('links the article through the resources route, not transcripts', () => {
    const steps = buildIngestMonitorSteps(
      makeArticleRun({
        status: 'completed',
        produced_node_count: 2,
        primary_link: { label: 'bounded-fetching', href: '/vault/resources/bounded-fetching' },
      }),
      'Article',
    );

    expect(steps[0]).toMatchObject({
      nodeCount: 1,
      items: [{ href: '/vault/resources/bounded-fetching' }],
    });
  });
});
