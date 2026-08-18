'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getSong } from '@/app/utils/getSong';
import { getSimilar } from '@/app/utils/getSimilar';
import { searchSongsByTitle } from '@/app/utils/searchSongByTitle';

type SongSummary = {
  id: number;
  title: string;
  artist: string;
  tag: string;
  year: number | null;
  views: number | null;
  level_1: string | null;
  level_2: string | null;
  level_3: string | null;
};

type ClusterRecord = {
  id: string;
  level: 1 | 2 | 3;
  parent_cluster_id: string | null;
  name: string;
  keywords: string[];
  closest_to_centroid_song_ids: number[];
  most_viewed_song_ids: number[];
};

type RepresentativeSongsState = {
  centroid: SongSummary[];
  popular: SongSummary[];
  loading: boolean;
  error: string | null;
};

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseClusterId(value: unknown) {
  return value === null || value === undefined || value === '' ? null : String(value);
}

function formatCount(value: number | null) {
  return value === null ? 'Unknown' : value.toLocaleString();
}

function normalizeSong(song: unknown): SongSummary | null {
  if (!song || typeof song !== 'object') {
    return null;
  }

  const row = song as Record<string, unknown>;
  const id = toFiniteNumber(row.id);

  if (id === null) {
    return null;
  }

  return {
    id,
    title: String(row.title ?? `Song ${id}`),
    artist: String(row.artist ?? 'Unknown artist'),
    tag: String(row.tag ?? 'Unknown'),
    year: toFiniteNumber(row.year),
    views: toFiniteNumber(row.views),
    level_1: parseClusterId(row.L1 ?? row.level_1),
    level_2: parseClusterId(row.L2 ?? row.level_2),
    level_3: parseClusterId(row.L3 ?? row.level_3),
  };
}

function normalizeCluster(row: Record<string, unknown>): ClusterRecord | null {
  const level = Number(row.level);

  if (level !== 1 && level !== 2 && level !== 3) {
    return null;
  }

  return {
    id: String(row.id),
    level,
    parent_cluster_id: parseClusterId(row.parent_cluster_id),
    name: String(row.name ?? `Cluster ${row.id}`),
    keywords: Array.isArray(row.keywords) ? row.keywords.map((keyword) => String(keyword)) : [],
    closest_to_centroid_song_ids: Array.isArray(row.closest_to_centroid_song_ids)
      ? row.closest_to_centroid_song_ids
          .map((songId) => toFiniteNumber(songId))
          .filter((songId): songId is number => songId !== null)
      : [],
    most_viewed_song_ids: Array.isArray(row.most_viewed_song_ids)
      ? row.most_viewed_song_ids
          .map((songId) => toFiniteNumber(songId))
          .filter((songId): songId is number => songId !== null)
      : [],
  };
}

const songRequestCache = new Map<number, Promise<SongSummary | null>>();

async function loadSongDetails(songId: number) {
  const cachedRequest = songRequestCache.get(songId);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = getSong(songId)
    .then((song) => normalizeSong(song))
    .catch(() => null);

  songRequestCache.set(songId, request);
  return request;
}

function buildAncestry(clusterId: string | null, clusterMap: Map<string, ClusterRecord>) {
  const path: ClusterRecord[] = [];
  let current = clusterId ? clusterMap.get(clusterId) ?? null : null;

  while (current) {
    path.unshift(current);
    current = current.parent_cluster_id ? clusterMap.get(current.parent_cluster_id) ?? null : null;
  }

  return path;
}

type SongCardProps = {
  song: SongSummary;
  onSelect: (songId: number) => void;
  highlighted?: boolean;
};

function SongCard({ song, onSelect, highlighted }: SongCardProps) {
  return (
    <button
      type='button'
      onClick={() => onSelect(song.id)}
      className={`w-full min-w-0 rounded-md border px-3 py-2.5 text-left transition ${
        highlighted
          ? 'border-black bg-black text-white shadow-[0_12px_28px_rgba(43,29,18,0.2)]'
          : 'border-black/10 bg-white/90 text-black hover:border-black/20 hover:bg-black/[0.03]'
      }`}
    >
      <p
        className={`truncate text-[10px] font-semibold uppercase tracking-[0.2em] ${
          highlighted ? 'text-white/65' : 'text-black/45'
        }`}
      >
        {song.artist}
      </p>
      <h4 className='mt-1 truncate text-sm font-semibold leading-5'>{song.title}</h4>
      <p
        className={`mt-1.5 truncate text-xs leading-5 ${
          highlighted ? 'text-white/72' : 'text-black/62'
        }`}
      >
        {song.tag} • {song.year ?? 'Unknown year'} • {formatCount(song.views)} views
      </p>
    </button>
  );
}

export default function SimilarSongsPage() {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [clusterMap, setClusterMap] = useState<Map<string, ClusterRecord>>(new Map());

  const [selectedSong, setSelectedSong] = useState<SongSummary | null>(null);
  const [songLoading, setSongLoading] = useState(false);
  const [songError, setSongError] = useState<string | null>(null);

  const [similarSongs, setSimilarSongs] = useState<SongSummary[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [similarError, setSimilarError] = useState<string | null>(null);

  const [representativeSongs, setRepresentativeSongs] = useState<RepresentativeSongsState>({
    centroid: [],
    popular: [],
    loading: false,
    error: null,
  });

  const requestIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    fetch('/clusters.json', { cache: 'force-cache' })
      .then((response) => response.json())
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) {
          return;
        }

        const normalized = rows
          .map((row) => normalizeCluster(row as Record<string, unknown>))
          .filter((row): row is ClusterRecord => row !== null);

        setClusterMap(new Map(normalized.map((cluster) => [cluster.id, cluster])));
      })
      .catch(() => {
        // cluster names are a nice-to-have; the page still works without them
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setSearching(true);
    setSearchError(null);

    const timeoutId = setTimeout(() => {
      searchSongsByTitle(trimmed, 8)
        .then((results) => {
          if (requestIdRef.current !== currentRequestId) {
            return;
          }

          const rows = Array.isArray(results) ? results : [];
          const normalized = rows
            .map((row) => normalizeSong(row))
            .filter((row): row is SongSummary => row !== null);

          setSearchResults(normalized);
          setSearching(false);
        })
        .catch((err: unknown) => {
          if (requestIdRef.current !== currentRequestId) {
            return;
          }

          setSearchError(err instanceof Error ? err.message : 'Unable to search for songs.');
          setSearchResults([]);
          setSearching(false);
        });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const selectSong = (songId: number) => {
    let cancelled = false;

    requestIdRef.current += 1; // cancel any in-flight search so it can't repopulate the dropdown
    setQuery('');
    setSearchResults([]);
    setSearching(false);

    setSongLoading(true);
    setSongError(null);
    setSelectedSong(null);
    setSimilarSongs([]);
    setSimilarError(null);
    setSimilarLoading(true);

    getSong(songId)
      .then((song) => {
        if (cancelled) {
          return;
        }

        const normalized = normalizeSong(song);
        if (normalized) {
          setSelectedSong(normalized);
        } else {
          setSongError('Unable to load details for the selected song.');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSongError(err instanceof Error ? err.message : 'Unable to load the selected song.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSongLoading(false);
        }
      });

    getSimilar(songId, 20)
      .then((results) => {
        if (cancelled) {
          return;
        }

        const rows = Array.isArray(results) ? results : [];
        const normalized = rows
          .map((row) => normalizeSong(row))
          .filter((row): row is SongSummary => row !== null);

        setSimilarSongs(normalized);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSimilarError(err instanceof Error ? err.message : 'Unable to load similar songs.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSimilarLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  };

  const handleNewSearch = () => {
    setSelectedSong(null);
    setSongError(null);
    setSimilarSongs([]);
    setSimilarError(null);
    setQuery('');
    setSearchResults([]);
  };

  const ancestry = useMemo(
    () => buildAncestry(selectedSong?.level_3 ?? selectedSong?.level_2 ?? selectedSong?.level_1 ?? null, clusterMap),
    [clusterMap, selectedSong]
  );
  const selectedCluster = ancestry.length > 0 ? ancestry[ancestry.length - 1] : null;

  useEffect(() => {
    let cancelled = false;

    async function loadRepresentativeSongs() {
      if (!selectedCluster) {
        setRepresentativeSongs({ centroid: [], popular: [], loading: false, error: null });
        return;
      }

      try {
        setRepresentativeSongs({ centroid: [], popular: [], loading: true, error: null });

        const [centroidSongs, popularSongs] = await Promise.all([
          Promise.all(selectedCluster.closest_to_centroid_song_ids.slice(0, 3).map((songId) => loadSongDetails(songId))),
          Promise.all(selectedCluster.most_viewed_song_ids.slice(0, 3).map((songId) => loadSongDetails(songId))),
        ]);

        if (!cancelled) {
          setRepresentativeSongs({
            centroid: centroidSongs.filter((song): song is SongSummary => song !== null),
            popular: popularSongs.filter((song): song is SongSummary => song !== null),
            loading: false,
            error: null,
          });
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setRepresentativeSongs({
            centroid: [],
            popular: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Unable to load representative songs.',
          });
        }
      }
    }

    loadRepresentativeSongs();

    return () => {
      cancelled = true;
    };
  }, [selectedCluster]);

  return (
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:px-6 lg:py-10'>
      <div>
        <p className='text-xs font-semibold uppercase tracking-[0.28em] text-black/50'>
          Similar Songs
        </p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-black sm:text-4xl'>
          Find songs and explore what sounds like them.
        </h1>
      </div>

      <div className='relative'>
        <input
          type='text'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='Search for a song by title...'
          className='w-full rounded-sm border border-black/10 bg-white/90 px-5 py-3 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black/30 focus:ring-4 focus:ring-black/5'
        />

        {query.trim().length >= 2 && (
          <div className='absolute z-10 mt-2 w-full space-y-2 rounded-md border border-black/10 bg-white/95 p-2 shadow-[0_16px_40px_rgba(43,29,18,0.12)]'>
            {searching && (
              <p className='px-2 py-1.5 text-xs text-black/55'>Searching...</p>
            )}
            {searchError && <p className='px-2 py-1.5 text-xs text-red-600'>{searchError}</p>}
            {!searching && !searchError && searchResults.length === 0 && (
              <p className='px-2 py-1.5 text-xs text-black/55'>No songs found.</p>
            )}
            {!searching &&
              searchResults.map((song) => (
                <SongCard key={song.id} song={song} onSelect={selectSong} highlighted={selectedSong?.id === song.id} />
              ))}
          </div>
        )}
      </div>

      {songError && (
        <div className='rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
          <strong>Error:</strong> {songError}
        </div>
      )}

      {(songLoading || selectedSong) && (
        <div className='grid gap-4 lg:grid-cols-[1fr_1.4fr]'>
          <div className='min-w-0 rounded-md border border-black/10 bg-white/85 p-5 shadow-[0_16px_40px_rgba(43,29,18,0.08)]'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.26em] text-black/50'>
                Selected song
              </p>
              <button
                type='button'
                onClick={handleNewSearch}
                className='shrink-0 rounded-sm border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-black transition hover:border-black/20 hover:bg-black/[0.03]'
              >
                New search
              </button>
            </div>

            {songLoading ? (
              <p className='mt-4 text-sm text-black/55'>Loading song details...</p>
            ) : selectedSong ? (
              <>
                <p className='mt-4 truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45'>
                  {selectedSong.artist}
                </p>
                <h2 className='mt-1 truncate text-xl font-semibold leading-6 text-black'>
                  {selectedSong.title}
                </h2>
                <p className='mt-2 text-sm leading-6 text-black/62'>
                  {selectedSong.tag} • {selectedSong.year ?? 'Unknown year'} • {formatCount(selectedSong.views)} views
                </p>

                <p className='mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50'>
                  Cluster path
                </p>
                <div className='mt-2 flex flex-wrap gap-1.5'>
                  {ancestry.length > 0 ? (
                    ancestry.map((cluster) => (
                      <span
                        key={cluster.id}
                        className='rounded-sm border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium text-black/70'
                      >
                        L{cluster.level} {cluster.name}
                      </span>
                    ))
                  ) : (
                    <span className='text-[11px] text-black/50'>No cluster path available.</span>
                  )}
                </div>

                {selectedCluster && (
                  <>
                    <p className='mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50'>
                      Cluster keywords
                    </p>
                    <div className='mt-2 flex flex-wrap gap-1.5'>
                      {selectedCluster.keywords.length > 0 ? (
                        selectedCluster.keywords.slice(0, 8).map((keyword) => (
                          <span
                            key={keyword}
                            className='rounded-sm border border-black/10 bg-black/[0.03] px-2.5 py-1 text-[11px] font-medium text-black/70'
                          >
                            {keyword}
                          </span>
                        ))
                      ) : (
                        <span className='text-[11px] text-black/50'>No keywords available.</span>
                      )}
                    </div>

                    {representativeSongs.error && (
                      <p className='mt-3 text-xs text-red-600'>{representativeSongs.error}</p>
                    )}

                    <p className='mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50'>
                      Popular in this cluster
                    </p>
                    <div className='mt-2 space-y-2'>
                      {representativeSongs.popular.map((song) => (
                        <SongCard
                          key={`popular-${song.id}`}
                          song={song}
                          onSelect={selectSong}
                          highlighted={selectedSong?.id === song.id}
                        />
                      ))}
                      {representativeSongs.loading && (
                        <p className='text-xs leading-5 text-black/55'>Loading...</p>
                      )}
                      {!representativeSongs.loading && representativeSongs.popular.length === 0 && (
                        <p className='text-xs leading-5 text-black/55'>No popular songs available.</p>
                      )}
                    </div>

                    <p className='mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50'>
                      Central to this cluster
                    </p>
                    <div className='mt-2 space-y-2'>
                      {representativeSongs.centroid.map((song) => (
                        <SongCard
                          key={`centroid-${song.id}`}
                          song={song}
                          onSelect={selectSong}
                          highlighted={selectedSong?.id === song.id}
                        />
                      ))}
                      {representativeSongs.loading && (
                        <p className='text-xs leading-5 text-black/55'>Loading...</p>
                      )}
                      {!representativeSongs.loading && representativeSongs.centroid.length === 0 && (
                        <p className='text-xs leading-5 text-black/55'>No central songs available.</p>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>

          <div className='min-w-0 rounded-md border border-black/10 bg-white/85 p-5 shadow-[0_16px_40px_rgba(43,29,18,0.08)]'>
            <p className='text-[11px] font-semibold uppercase tracking-[0.26em] text-black/50'>
              Similar songs
            </p>

            {similarError && (
              <p className='mt-3 text-xs text-red-600'>{similarError}</p>
            )}

            <div className='mt-3 grid min-w-0 gap-2 sm:grid-cols-2 max-h-[32rem] overflow-y-auto pr-1'>
              {similarLoading && (
                <p className='text-xs leading-5 text-black/55'>Loading similar songs...</p>
              )}
              {!similarLoading && !similarError && similarSongs.length === 0 && (
                <p className='text-xs leading-5 text-black/55'>No similar songs found.</p>
              )}
              {!similarLoading &&
                similarSongs.map((song) => (
                  <SongCard key={song.id} song={song} onSelect={selectSong} highlighted={selectedSong?.id === song.id} />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
