import { ApiError } from '../api/client';

export function queryErrorTitle(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 403) return '无权查看此内容';
  return fallback;
}

export function queryErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '请检查网络或稍后重试';
}

export function canRetryQuery(error: unknown): boolean {
  return !(error instanceof ApiError && error.status === 403);
}
