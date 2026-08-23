import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiFailure, ApiSuccess } from '@pmp/shared-types';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly details?: unknown,
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
        const csrfToken = cookie('csrf_token');
        await axios.post(
          '/api/v2/auth/refresh',
          {},
          {
            withCredentials: true,
            headers: csrfToken ? { 'x-csrf-token': decodeURIComponent(csrfToken) } : undefined,
          },
        );
        return api.request(config);
      } catch {
        window.dispatchEvent(new Event('auth:expired'));
      }
    }
    const body = error.response?.data;
    throw new ApiError(
      body?.code ?? 'NETWORK_ERROR',
      body?.message ?? '网络请求失败',
      body?.requestId,
      body?.details,
    );
  },
);
export async function initializeCsrf(): Promise<void> {
  await api.get('/auth/csrf');
}
