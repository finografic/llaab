import { describe, expect, it } from 'vitest';

import {
  appendDatetimeFilenameSegment,
  buildRunNodeId,
  formatInstantForFilenameId,
  formatIsoUtcForTranscriptBody,
  formatIsoUtcSeconds,
  toNodeId,
} from './schema.utils.js';

describe('toNodeId', () => {
  it('collapses contractions with straight apostrophe', () => {
    expect(toNodeId("it's holding you back")).toBe('its-holding-you-back');
  });

  it('collapses contractions with curly apostrophe (U+2019)', () => {
    expect(toNodeId('Stop Using Claude \u2014 It\u2019s Holding You Back')).toBe(
      'stop-using-claude-its-holding-you-back',
    );
  });

  it('strips quoted words cleanly', () => {
    expect(toNodeId("food 'bar' baz")).toBe('food-bar-baz');
  });

  it('strips curly double quotes', () => {
    expect(toNodeId('\u201Chello world\u201D')).toBe('hello-world');
  });
});

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
