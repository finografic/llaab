import { describe, expect, it } from 'vitest';

import { findSkillRoutesByCapability, getRoutesFor } from './registry.js';

describe('skill registry capabilities', () => {
  it('keeps transcript extraction route queryable by node type', () => {
    expect(getRoutesFor('transcript').map((route) => route.skill)).toEqual(['extract-transcript-ideas']);
  });

  it('finds routes by declared capability', () => {
    expect(findSkillRoutesByCapability('extract').map((route) => route.skill)).toEqual([
      'extract-transcript-ideas',
    ]);
  });
});
