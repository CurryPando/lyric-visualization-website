import { fetchJson } from './apiClient';

// returns a list of songs matching the given title, with a default limit of 20
export async function searchSongsByTitle(title, limit = 20) {
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';

  if (!trimmedTitle) {
    throw new Error('searchSongsByTitle requires a non-empty title');
  }

  const params = new URLSearchParams({ title: trimmedTitle, limit: String(limit) });
  return fetchJson(`/api/search-by-title?${params.toString()}`);
}