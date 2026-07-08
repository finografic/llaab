import { describe, expect, it } from 'vitest';
import type { RunMonitorItem } from '@llaab/schemas';

import { buildIngestYoutubeMonitorSteps } from './run-pipeline-card.utils';

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

describe('buildIngestYoutubeMonitorSteps', () => {
  it('keeps extraction pending while the transcript is still processing', () => {
    const steps = buildIngestYoutubeMonitorSteps(makeIngestRun());

    expect(steps).toMatchObject([
      { id: 'transcript', status: 'active', title: 'Transcript processing' },
      { id: 'extraction', status: 'pending', title: 'Extraction pending' },
    ]);
  });

  it('marks extraction active once extraction has started', () => {
    const steps = buildIngestYoutubeMonitorSteps(
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
