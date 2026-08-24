import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure, ApiSuccess } from '@pmp/shared-types';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}
let refreshPromise: Promise<void> | null = null;
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
    public readonly status?: number,
  ) {
    super(message);
  }
}
export const api = axios.create({
  baseURL: '/api/v2',
  withCredentials: true,
  timeout: 20_000,
  headers: { 'content-type': 'application/json' },
});

export function compactParams(params: unknown): unknown {
  if (!params || typeof params !== 'object' || params instanceof URLSearchParams) return params;
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== undefined && value !== null,
    ),
  );
}

function cookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}
export function refreshSession(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  const csrfToken = cookie('csrf_token');
  refreshPromise = axios
    .post(
      '/api/v2/auth/refresh',
      {},
      {
        withCredentials: true,
        headers: csrfToken ? { 'x-csrf-token': decodeURIComponent(csrfToken) } : undefined,
      },
    )
    .then(() => undefined)
    .catch((error: unknown) => {
      window.dispatchEvent(new Event('auth:expired'));
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
api.interceptors.request.use((config) => {
  config.params = compactParams(config.params);
  if (!['get', 'head', 'options'].includes(config.method?.toLowerCase() ?? 'get')) {
    const token = cookie('csrf_token');
    if (token) config.headers.set('x-csrf-token', decodeURIComponent(token));
  }
  return config;
});
api.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiSuccess<unknown>;
    return payload && payload.success === true ? { ...response, data: payload.data } : response;
  },
  async (error: AxiosError<ApiFailure>) => {
    const config = error.config as RetryConfig | undefined;
    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !config.url?.includes('/auth/')
    ) {
      config._retried = true;
      try {
        await refreshSession();
        return api.request(config);
      } catch {
        // refreshSession owns the single expiration event for all concurrent waiters.
      }
    }
    const body = error.response?.data;
    throw new ApiError(
      body?.code ?? 'NETWORK_ERROR',
      body?.message ?? '网络请求失败',
      body?.requestId,
      body?.details,
      error.response?.status,
    );
  },
);
export async function initializeCsrf(): Promise<void> {
  await api.get('/auth/csrf');
}
