import { QueryClient } from '@tanstack/react-query';

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = { ...(options.headers ?? {}) } as Record<string, string>;
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }

  return response.json();
}

export const queryClient = new QueryClient();
