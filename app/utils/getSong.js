import { fetchJson } from './apiClient';

export async function getSong(song_id) {
  if (song_id === null || song_id === undefined || song_id === '') {
    throw new Error('getSong requires a song_id');
  }

  return fetchJson(`/api/song/${encodeURIComponent(song_id)}`);
}