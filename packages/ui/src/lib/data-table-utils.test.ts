import { describe, expect, it } from 'vitest';

import { resolveDataTableMaxWidth, truncateChars } from './data-table-utils.js';

describe('truncateChars', () => {
  it('returns the original string when within the limit', () => {
    expect(truncateChars('short title', 60)).toBe('short title');
  });

  it('truncates with an ellipsis suffix', () => {
    const long = 'TypeScript, Agents, and What Skills Will Matter Tomorrow | Kent C Dodds | Ep 73B';
    expect(truncateChars(long, 60)).toBe('TypeScript, Agents, and What Skills Will Matter Tomorrow ...');
    expect(truncateChars(long, 60).length).toBe(60);
  });
});

describe('resolveDataTableMaxWidth', () => {
  it('converts numeric values to pixels', () => {
    expect(resolveDataTableMaxWidth(400)).toBe('400px');
  });

  it('passes through string values', () => {
    expect(resolveDataTableMaxWidth('24rem')).toBe('24rem');
  });
});
