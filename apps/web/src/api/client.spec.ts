import { describe, expect, it } from 'vitest';
import { compactParams } from './client';

describe('compactParams', () => {
  it('removes empty optional filters without dropping valid false or zero values', () => {
    expect(
      compactParams({ projectId: '', status: undefined, search: null, page: 1, active: false }),
    ).toEqual({ page: 1, active: false });
  });
});
