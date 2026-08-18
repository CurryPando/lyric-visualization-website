import { fetchJson } from './apiClient';

// returns a list of songs similar to the given song_id, with a default limit of 6
export async function getSimilar(song_id, limit = 6) {
  if (song_id === null || song_id === undefined || song_id === '') {
    throw new Error('getSimilar requires a song_id');
  }

  const params = new URLSearchParams({ song_id: String(song_id), limit: String(limit) });
  return fetchJson(`/api/similar-by-id?${params.toString()}`);
}