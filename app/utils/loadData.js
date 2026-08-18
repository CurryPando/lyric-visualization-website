import { fetchJson } from './apiClient';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '');
const CACHE_NAME = 'umap-data-v1';
const DATA_PATH = '/api/umap-cluster';
const DATA_URL = `${API_BASE_URL}${DATA_PATH}`;

export async function getUmapData() {
  // Cache Storage isn't available in all environments (e.g. SSR, some private-browsing modes)
  const cacheAvailable = typeof caches !== 'undefined';
  const cache = cacheAvailable ? await caches.open(CACHE_NAME) : null;
  const cachedResponse = cache ? await cache.match(DATA_URL) : undefined;

  if (cachedResponse) {
    try {
      return await cachedResponse.json();
    } catch {
      // fall through to a fresh network fetch if the cached entry is corrupt
    }
  }

  const data = await fetchJson(DATA_PATH);

  if (cache) {
    try {
      await cache.put(DATA_URL, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    } catch {
      // caching is a nice-to-have; ignore storage failures (e.g. quota exceeded)
    }
  }

  return data;
}