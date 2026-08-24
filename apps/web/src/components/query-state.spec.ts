import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { canRetryQuery, queryErrorMessage, queryErrorTitle } from './query-state';

describe('query error presentation', () => {
  it('distinguishes forbidden responses from retryable failures', () => {
    const forbidden = new ApiError('PERMISSION_DENIED', '禁止访问', undefined, undefined, 403);
    expect(queryErrorTitle(forbidden, '加载失败')).toBe('无权查看此内容');
    expect(queryErrorMessage(forbidden)).toBe('禁止访问');
    expect(canRetryQuery(forbidden)).toBe(false);
  });

  it('keeps network and server failures retryable', () => {
    const failure = new ApiError('NETWORK_ERROR', '网络请求失败', undefined, undefined, 500);
    expect(queryErrorTitle(failure, '任务加载失败')).toBe('任务加载失败');
    expect(canRetryQuery(failure)).toBe(true);
  });
});
