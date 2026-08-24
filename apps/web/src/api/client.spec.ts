import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compactParams, refreshSession } from './client';

describe('compactParams', () => {
  it('removes empty optional filters without dropping valid false or zero values', () => {
    expect(
      compactParams({ projectId: '', status: undefined, search: null, page: 1, active: false }),
    ).toEqual({ page: 1, active: false });
  });
});

describe('refreshSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('document', { cookie: '' });
    vi.stubGlobal('window', new EventTarget());
  });

  it('uses one refresh request for concurrent 401 recovery', async () => {
    let resolveRefresh!: () => void;
    const request = vi.spyOn(axios, 'post').mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = () => resolve({ data: {} });
      }),
    );
    const attempts = [refreshSession(), refreshSession(), refreshSession()];
    expect(request).toHaveBeenCalledTimes(1);
    resolveRefresh();
    await Promise.all(attempts);
  });

  it('emits one expiration event when a shared refresh fails', async () => {
    let rejectRefresh!: (error: Error) => void;
    vi.spyOn(axios, 'post').mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    );
    const expired = vi.fn();
    window.addEventListener('auth:expired', expired);
    const attempts = [refreshSession(), refreshSession(), refreshSession()];
    rejectRefresh(new Error('expired'));
    await Promise.allSettled(attempts);
    expect(expired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:expired', expired);
  });
});
