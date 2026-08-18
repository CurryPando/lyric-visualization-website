// Shared fetch helper for the browser-side API utils (getSong, getSimilar, searchSongByTitle, loadData).
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Fetches `path` (relative to the API base URL) as JSON, with a timeout and normalized error handling. */
export async function fetchJson<T = unknown>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 408);
    }
    const message = error instanceof Error ? error.message : 'Unknown network error';
    throw new ApiError(`Network error while requesting ${path}: ${message}`, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      detail = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : undefined;
    } catch {
      // response body wasn't JSON (or was empty); fall back to the status text below
    }
    throw new ApiError(detail ?? `Request to ${path} failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}
