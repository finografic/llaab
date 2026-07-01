import { describe, expect, it } from 'bun:test';

import { getBalancedColumnCount, getResponsiveBalancedColumns } from './balanced-grid.utils';

describe('getBalancedColumnCount', () => {
  it('returns 1 for empty or single-item grids', () => {
    expect(getBalancedColumnCount(0)).toBe(1);
    expect(getBalancedColumnCount(1)).toBe(1);
  });

  it('uses one column per item when everything fits on one row', () => {
    expect(getBalancedColumnCount(3, { maxColumns: 4 })).toBe(3);
    expect(getBalancedColumnCount(4, { maxColumns: 4 })).toBe(4);
  });

  it('prefers even rows over trailing empty slots', () => {
    expect(getBalancedColumnCount(6, { maxColumns: 4 })).toBe(3);
    expect(getBalancedColumnCount(6, { maxColumns: 3 })).toBe(3);
  });

  it('avoids a lone item on the last row', () => {
    expect(getBalancedColumnCount(5, { maxColumns: 4 })).toBe(3);
    expect(getBalancedColumnCount(7, { maxColumns: 4 })).toBe(4);
  });

  it('stacks to one column when every multi-column option orphans', () => {
    expect(getBalancedColumnCount(3, { maxColumns: 2, minColumns: 2 })).toBe(1);
  });
});

describe('getResponsiveBalancedColumns', () => {
  it('returns balanced counts per breakpoint', () => {
    expect(getResponsiveBalancedColumns(6, { maxColumns: 4 })).toEqual({
      sm: 1,
      md: 2,
      lg: 3,
    });
  });
});
