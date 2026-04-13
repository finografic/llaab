import { describe, expect, it } from 'vitest';

import {
  appendDatetimeFilenameSegment,
  buildRunNodeId,
  formatInstantForFilenameId,
  formatIsoUtcForTranscriptBody,
  formatIsoUtcSeconds,
} from './schema.utils.js';

describe('canonical datetime helpers', () => {
  it('formatIsoUtcSeconds drops milliseconds', () => {
    const d = new Date('2026-04-12T15:59:39.859Z');
    expect(formatIsoUtcSeconds(d)).toBe('2026-04-12T15:59:39Z');
  });

  it('formatIsoUtcForTranscriptBody removes T and Z', () => {
    expect(formatIsoUtcForTranscriptBody('2026-04-12T15:59:39Z')).toBe('2026-04-12 15:59:39');
  });

  it('formatInstantForFilenameId matches filename id convention', () => {
    const d = new Date('2026-04-12T15:59:39.000Z');
    expect(formatInstantForFilenameId(d)).toBe('2026-04-12T15-59-39');
  });

  it('appendDatetimeFilenameSegment uses underscore before datetime', () => {
    const d = new Date('2026-04-12T15:59:39.000Z');
    expect(appendDatetimeFilenameSegment('demo-skill-run', d)).toBe('demo-skill-run_2026-04-12T15-59-39');
  });

  it('buildRunNodeId joins skill slug and instant with underscore before datetime', () => {
    const d = new Date('2026-04-12T15:59:39.000Z');
    expect(buildRunNodeId('ingest-youtube', d)).toBe('ingest-youtube-run_2026-04-12T15-59-39');
  });
});
