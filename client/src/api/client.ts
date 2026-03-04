import { useAuthStore } from '../stores/use-auth-store';

const BASE_URL = '/api';
const REQUEST_TIMEOUT = 30_000; // 30s timeout for all API requests

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Abort controller with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      signal: init?.signal || controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, body.error || res.statusText);
    }

    return res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new ApiError(408, 'Request timeout');
    }
    throw new ApiError(0, (err as Error).message || 'Network error');
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Open the login modal (call explicitly from user-initiated actions only) */
export function openLoginModal() {
  useAuthStore.getState().setLoginModalOpen(true);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
