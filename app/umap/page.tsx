'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, useTransition } from 'react';
import type { Data, Layout, PlotMouseEvent } from 'plotly.js';

import { getSong } from '@/app/utils/getSong';
import { getUmapData } from '@/app/utils/loadData';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className='flex h-full items-center justify-center text-sm text-black/55'>
      Loading Plotly renderer...
    </div>
  ),
});

type UmapPoint = {
  id: number;
  title: string;
  tag: string;
  artist: string;
  year: number | null;
  views: number | null;
  x: number;
  y: number;
  level_1: string | null;
  level_2: string | null;
  level_3: string | null;
};

type ClusterLevel = 1 | 2 | 3;

type ClusterRecord = {
  id: string;
  level: ClusterLevel;
  parent_cluster_id: string | null;
  song_count: number;
  keywords: string[];
  closest_to_centroid_song_ids: number[];
  most_viewed_song_ids: number[];
  name: string;
};

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

type RepresentativeSongsState = {
  centroid: SongSummary[];
  popular: SongSummary[];
  loading: boolean;
  error: string | null;
};

const palette = [
  '#2b1d12',
  '#b5651d',
  '#8a6d3b',
  '#a13d2e',
  '#c98a2c',
  '#6b4226',
  '#d97b3f',
  '#7c5a3a',
  '#9c5b2e',
  '#4d3319',
];

const songRequestCache = new Map<number, Promise<SongSummary | null>>();

function parseClusterId(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return String(value);
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCount(value: number | null) {
  return value === null ? 'Unknown' : value.toLocaleString();
}

function normalizePoint(row: Record<string, unknown>): UmapPoint | null {
  const id = toFiniteNumber(row.id);
  const x = toFiniteNumber(row.x);
  const y = toFiniteNumber(row.y);

  if (id === null || x === null || y === null) {
    return null;
  }

  return {
    id,
    title: String(row.title ?? `Song ${id}`),
    tag: String(row.tag ?? 'Unknown'),
    artist: String(row.artist ?? 'Unknown artist'),
    year: toFiniteNumber(row.year),
    views: toFiniteNumber(row.views),
    x,
    y,
    level_1: parseClusterId(row.L1),
    level_2: parseClusterId(row.L2),
    level_3: parseClusterId(row.L3),
  };
}

function normalizeCluster(row: Record<string, unknown>): ClusterRecord | null {
  const level = Number(row.level);
  const songCount = toFiniteNumber(row.song_count);

  if ((level !== 1 && level !== 2 && level !== 3) || songCount === null) {
    return null;
  }

  return {
    id: String(row.id),
    level,
    parent_cluster_id: parseClusterId(row.parent_cluster_id),
    song_count: songCount,
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
    name: String(row.name ?? `Cluster ${row.id}`),
  };
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

function getClusterName(clusterId: string | null, clusterMap: Map<string, ClusterRecord>) {
  if (!clusterId) {
    return 'Unassigned';
  }

  return clusterMap.get(clusterId)?.name ?? clusterId;
}

function belongsToCluster(point: UmapPoint, cluster: ClusterRecord) {
  if (cluster.level === 1) {
    return point.level_1 === cluster.id;
  }

  if (cluster.level === 2) {
    return point.level_2 === cluster.id;
  }

  return point.level_3 === cluster.id;
}

function getChildClusterId(point: UmapPoint, clusterLevel: ClusterLevel) {
  if (clusterLevel === 1) {
    return point.level_2;
  }

  if (clusterLevel === 2) {
    return point.level_3;
  }

  return null;
}

function buildAncestry(cluster: ClusterRecord | null, clusterMap: Map<string, ClusterRecord>) {
  const path: ClusterRecord[] = [];
  let current = cluster;

  while (current) {
    path.unshift(current);
    current = current.parent_cluster_id ? clusterMap.get(current.parent_cluster_id) ?? null : null;
  }

  return path;
}

function buildDetailTrace(
  name: string,
  rows: UmapPoint[],
  color: string,
  clusterMap: Map<string, ClusterRecord>
): Data {
  return {
    type: 'scattergl',
    mode: 'markers',
    name,
    x: rows.map((row) => row.x),
    y: rows.map((row) => row.y),
    text: rows.map((row) => row.title),
    customdata: rows.map((row) => [
      row.artist,
      row.tag,
      row.year ?? 'Unknown',
      row.views ?? 'Unknown',
      getClusterName(row.level_1, clusterMap),
      getClusterName(row.level_2, clusterMap),
      getClusterName(row.level_3, clusterMap),
      row.id,
    ]),
    hovertemplate:
      '<b>%{text}</b><br>' +
      'Artist: %{customdata[0]}<br>' +
      'Genre: %{customdata[1]}<br>' +
      'Year: %{customdata[2]}<br>' +
      'Views: %{customdata[3]}<br>' +
      'Level 1: %{customdata[4]}<br>' +
      'Level 2: %{customdata[5]}<br>' +
      'Level 3: %{customdata[6]}<br>' +
      'ID: %{customdata[7]}<extra></extra>',
    marker: {
      size: 7,
      opacity: 0.82,
      color,
      line: {
        width: 0,
      },
    },
  };
}

function extractSongIdFromEvent(event: Readonly<PlotMouseEvent>) {
  const clickedPoint = event.points?.[0];

  if (!clickedPoint || !Array.isArray(clickedPoint.customdata)) {
    return null;
  }

  const songId = Number(clickedPoint.customdata[7]);
  return Number.isFinite(songId) ? songId : null;
}

type ClusterButtonProps = {
  cluster: ClusterRecord;
  active: boolean;
  onSelect: (clusterId: string) => void;
};

function ClusterButton({ cluster, active, onSelect }: ClusterButtonProps) {
  return (
    <button
      type='button'
      onClick={() => onSelect(cluster.id)}
      className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
        active
          ? 'border-black bg-black text-white shadow-[0_12px_28px_rgba(43,29,18,0.2)]'
          : 'border-black/10 bg-white/90 text-black hover:border-black/20 hover:bg-black/[0.03]'
      }`}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${active ? 'text-white/65' : 'text-black/45'}`}>
            Level {cluster.level}
          </p>
          <h3 className='mt-1 truncate text-sm font-semibold leading-5'>{cluster.name}</h3>
        </div>
        <span className={`shrink-0 rounded-sm px-2.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-white/12 text-white' : 'bg-black/5 text-black/65'}`}>
          {cluster.song_count.toLocaleString()}
        </span>
      </div>
      <p className={`mt-1.5 truncate text-xs leading-5 ${active ? 'text-white/72' : 'text-black/62'}`}>
        {cluster.keywords.slice(0, 5).join(' • ') || 'No keywords available'}
      </p>
    </button>
  );
}

type SongButtonProps = {
  song: SongSummary;
  active: boolean;
  onSelect: (song: SongSummary) => void;
};

function SongButton({ song, active, onSelect }: SongButtonProps) {
  return (
    <button
      type='button'
      onClick={() => onSelect(song)}
      className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
        active
          ? 'border-black bg-black text-white shadow-[0_12px_28px_rgba(43,29,18,0.2)]'
          : 'border-black/10 bg-white/90 text-black hover:border-black/20 hover:bg-black/[0.03]'
      }`}
    >
      <p className={`truncate text-[10px] font-semibold uppercase tracking-[0.2em] ${active ? 'text-white/65' : 'text-black/45'}`}>
        {song.artist}
      </p>
      <h4 className='mt-1 truncate text-sm font-semibold leading-5'>{song.title}</h4>
      <p className={`mt-1.5 truncate text-xs leading-5 ${active ? 'text-white/72' : 'text-black/62'}`}>
        {song.tag} • {song.year ?? 'Unknown year'} • {formatCount(song.views)} views
      </p>
    </button>
  );
}

export default function UmapPage() {
  const [points, setPoints] = useState<UmapPoint[]>([]);
  const [clusters, setClusters] = useState<ClusterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [focusedSongId, setFocusedSongId] = useState<number | null>(null);
  const [focusedSong, setFocusedSong] = useState<SongSummary | null>(null);
  const [focusedSongLoading, setFocusedSongLoading] = useState(false);
  const [focusedSongError, setFocusedSongError] = useState<string | null>(null);
  const [representativeSongs, setRepresentativeSongs] = useState<RepresentativeSongsState>({
    centroid: [],
    popular: [],
    loading: false,
    error: null,
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadExplorerData() {
      try {
        setLoading(true);
        setError(null);

        const [rawData, clusterResponse] = await Promise.all([
          getUmapData(),
          fetch('/clusters.json', { cache: 'force-cache' }),
        ]);

        if (!clusterResponse.ok) {
          throw new Error('Unable to load cluster metadata.');
        }

        const clusterData = await clusterResponse.json();
        const rows = Array.isArray(rawData) ? rawData : rawData?.data;

        if (!Array.isArray(rows)) {
          throw new Error('UMAP data response must be an array of rows.');
        }

        if (!Array.isArray(clusterData)) {
          throw new Error('Cluster metadata response must be an array of rows.');
        }

        const normalizedPoints = rows
          .map((row) => normalizePoint(row as Record<string, unknown>))
          .filter((row): row is UmapPoint => row !== null);

        const normalizedClusters = clusterData
          .map((row) => normalizeCluster(row as Record<string, unknown>))
          .filter((row): row is ClusterRecord => row !== null)
          .sort((left, right) => {
            if (left.level !== right.level) {
              return left.level - right.level;
            }

            return right.song_count - left.song_count;
          });

        if (!cancelled) {
          setPoints(normalizedPoints);
          setClusters(normalizedClusters);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load the cluster explorer.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadExplorerData();

    return () => {
      cancelled = true;
    };
  }, []);

  const clusterMap = useMemo(() => new Map(clusters.map((cluster) => [cluster.id, cluster])), [clusters]);

  const childrenByParent = useMemo(() => {
    const next = new Map<string, ClusterRecord[]>();

    for (const cluster of clusters) {
      if (!cluster.parent_cluster_id) {
        continue;
      }

      const currentChildren = next.get(cluster.parent_cluster_id);
      if (currentChildren) {
        currentChildren.push(cluster);
      } else {
        next.set(cluster.parent_cluster_id, [cluster]);
      }
    }

    for (const entry of next.values()) {
      entry.sort((left, right) => right.song_count - left.song_count);
    }

    return next;
  }, [clusters]);

  const rootClusters = useMemo(
    () => clusters.filter((cluster) => cluster.level === 1).sort((left, right) => right.song_count - left.song_count),
    [clusters]
  );

  const effectiveSelectedClusterId =
    selectedClusterId && clusterMap.has(selectedClusterId) ? selectedClusterId : null;

  const selectedCluster = effectiveSelectedClusterId ? clusterMap.get(effectiveSelectedClusterId) ?? null : null;
  const parentCluster = selectedCluster?.parent_cluster_id
    ? clusterMap.get(selectedCluster.parent_cluster_id) ?? null
    : null;
  const childClusters = useMemo(
    () => (selectedCluster ? childrenByParent.get(selectedCluster.id) ?? [] : []),
    [childrenByParent, selectedCluster]
  );
  const peerClusters = useMemo(
    () => (parentCluster ? childrenByParent.get(parentCluster.id) ?? [] : rootClusters),
    [childrenByParent, parentCluster, rootClusters]
  );
  const ancestry = useMemo(() => buildAncestry(selectedCluster, clusterMap), [clusterMap, selectedCluster]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadFocusedSong() {
      if (focusedSongId === null) {
        setFocusedSong(null);
        setFocusedSongLoading(false);
        setFocusedSongError(null);
        return;
      }

      if (focusedSong?.id === focusedSongId) {
        return;
      }

      try {
        setFocusedSongLoading(true);
        setFocusedSongError(null);

        const song = await loadSongDetails(focusedSongId);

        if (!cancelled) {
          if (song) {
            setFocusedSong(song);
          } else {
            setFocusedSongError('Unable to load song details for the selected point.');
          }
        }
      } finally {
        if (!cancelled) {
          setFocusedSongLoading(false);
        }
      }
    }

    loadFocusedSong();

    return () => {
      cancelled = true;
    };
  }, [focusedSong, focusedSongId]);

  const plotState = useMemo(() => {
    if (!selectedCluster) {
      const traces: Data[] =
        points.length > 0
          ? [
              {
                type: 'scattergl',
                mode: 'markers',
                name: 'All songs',
                x: points.map((point) => point.x),
                y: points.map((point) => point.y),
                hoverinfo: 'skip',
                showlegend: false,
                marker: {
                  size: 4,
                  opacity: 0.12,
                  color: 'rgba(148,163,184,0.35)',
                },
              },
            ]
          : [];

      return {
        traces,
        selectedPointCount: 0,
        backgroundPointCount: points.length,
      };
    }

    const backgroundRows: UmapPoint[] = [];
    const selectedRows: UmapPoint[] = [];
    const childRows = new Map<string, UmapPoint[]>();
    const fallbackRows: UmapPoint[] = [];

    for (const point of points) {
      if (!belongsToCluster(point, selectedCluster)) {
        backgroundRows.push(point);
        continue;
      }

      selectedRows.push(point);

      if (childClusters.length === 0) {
        continue;
      }

      const childClusterId = getChildClusterId(point, selectedCluster.level);
      if (!childClusterId) {
        fallbackRows.push(point);
        continue;
      }

      const existingRows = childRows.get(childClusterId);
      if (existingRows) {
        existingRows.push(point);
      } else {
        childRows.set(childClusterId, [point]);
      }
    }

    const traces: Data[] = [];

    if (backgroundRows.length > 0) {
      traces.push({
        type: 'scattergl',
        mode: 'markers',
        name: 'Other songs',
        x: backgroundRows.map((row) => row.x),
        y: backgroundRows.map((row) => row.y),
        hoverinfo: 'skip',
        showlegend: false,
        marker: {
          size: 4,
          opacity: 0.04,
          color: 'rgba(148,163,184,0.14)',
        },
      });
    }

    if (childClusters.length === 0) {
      traces.push(buildDetailTrace(selectedCluster.name, selectedRows, palette[0], clusterMap));
    } else {
      childClusters.forEach((childCluster, index) => {
        const rows = childRows.get(childCluster.id) ?? [];
        if (rows.length > 0) {
          traces.push(buildDetailTrace(childCluster.name, rows, palette[index % palette.length], clusterMap));
        }
      });

      if (fallbackRows.length > 0) {
        traces.push(buildDetailTrace('Within cluster, not subdivided', fallbackRows, '#475569', clusterMap));
      }
    }

    return {
      traces,
      selectedPointCount: selectedRows.length,
      backgroundPointCount: backgroundRows.length,
    };
  }, [childClusters, clusterMap, points, selectedCluster]);

  const layout: Partial<Layout> = {
    title: undefined,
    paper_bgcolor: 'rgba(43,29,18,0)',
    plot_bgcolor: 'rgba(255,255,255,0.65)',
    dragmode: 'pan',
    hovermode: 'closest',
    uirevision: 'cluster-explorer',
    legend: {
      orientation: 'h',
      y: 1.12,
      x: 0,
    },
    margin: {
      l: 48,
      r: 24,
      t: 70,
      b: 48,
    },
    xaxis: {
      title: {
        text: 'UMAP X',
      },
      zeroline: false,
      gridcolor: 'rgba(43,29,18, 0.08)',
    },
    yaxis: {
      title: {
        text: 'UMAP Y',
      },
      zeroline: false,
      gridcolor: 'rgba(43,29,18, 0.08)',
    },
  };

  const handleSelectCluster = (clusterId: string | null) => {
    startTransition(() => {
      setSelectedClusterId(clusterId);
      setFocusedSongId(null);
      setFocusedSong(null);
      setFocusedSongLoading(false);
      setFocusedSongError(null);
    });
  };

  const handleSelectSong = (song: SongSummary) => {
    setFocusedSong(song);
    setFocusedSongId(song.id);
    setFocusedSongLoading(false);
    setFocusedSongError(null);
  };

  const focusedSongPath = focusedSong
    ? [focusedSong.level_1, focusedSong.level_2, focusedSong.level_3]
        .filter((clusterId): clusterId is string => Boolean(clusterId))
        .map((clusterId) => getClusterName(clusterId, clusterMap))
    : [];

  const childSectionTitle = !selectedCluster
    ? 'Level 1 clusters'
    : `Child level ${Math.min(selectedCluster.level + 1, 3)} subclusters`;

  const nextClusters = !selectedCluster ? rootClusters : childClusters;
  const metadataSongCount = selectedCluster?.song_count ?? 0;

  return (
    <div className='mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-4 lg:h-full lg:flex-row lg:overflow-hidden lg:px-6 lg:py-6'>
      <aside className='flex w-full flex-col gap-4 lg:h-full lg:w-[340px] lg:shrink-0 lg:overflow-hidden'>
        <div className='flex flex-1 min-h-0 flex-col gap-4 overflow-hidden rounded-md border border-black/10 bg-white/85 p-4 shadow-[0_16px_40px_rgba(43,29,18,0.08)]'>
          <div className='shrink-0'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-[11px] font-semibold uppercase tracking-[0.26em] text-black/50'>
                Cluster Explorer
              </p>
              {selectedCluster && (
                <button
                  type='button'
                  onClick={() => handleSelectCluster(parentCluster ? parentCluster.id : null)}
                  className='shrink-0 rounded-sm border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-black transition hover:border-black/20 hover:bg-black/[0.03]'
                >
                  ← Back
                </button>
              )}
            </div>
            <div className='mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/48'>
              {loading ? (
                <span>Loading...</span>
              ) : (
                <>
                  <button
                    type='button'
                    onClick={() => handleSelectCluster(null)}
                    className={`truncate rounded-sm border px-2.5 py-1 transition ${
                      !selectedCluster
                        ? 'border-black bg-black text-white'
                        : 'border-black/10 bg-black/[0.03] text-black/70 hover:border-black/20'
                    }`}
                  >
                    All clusters
                  </button>
                  {ancestry.map((cluster) => (
                    <button
                      key={cluster.id}
                      type='button'
                      onClick={() => handleSelectCluster(cluster.id)}
                      className={`truncate rounded-sm border px-2.5 py-1 transition ${
                        selectedCluster?.id === cluster.id
                          ? 'border-black bg-black text-white'
                          : 'border-black/10 bg-black/[0.03] text-black/70 hover:border-black/20'
                      }`}
                    >
                      L{cluster.level} {cluster.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

          {selectedCluster && (
            <>
              <div className='mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/50'>
                <span>{metadataSongCount.toLocaleString()} songs</span>
                <span>{childClusters.length.toLocaleString()} children</span>
                {selectedCluster.keywords.slice(0, 8).join(' · ')}
              </div>
            </>
          )}

          <div className='shrink-0 border-t border-black/10' />

          <div className='flex min-h-0 flex-1 flex-col'>
            <p className='shrink-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-black/50'>
              {childSectionTitle}
            </p>
            <div className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
              {nextClusters.length === 0 ? (
                <p>This cluster has no child clusters.</p>
              ) : (
                nextClusters.map((cluster) => (
                  <ClusterButton
                    key={cluster.id}
                    cluster={cluster}
                    active={selectedCluster?.id === cluster.id}
                    onSelect={handleSelectCluster}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </aside>

      <main className='flex min-h-0 w-full flex-1 flex-col gap-4 lg:h-full'>
        <div className='flex min-h-0 flex-1 flex-col rounded-md border border-black/10 bg-white/85 p-4 shadow-[0_16px_40px_rgba(43,29,18,0.06)]'>
          {loading ? (
            <div className='flex h-full items-center justify-center text-sm text-black/55'>
              Loading cluster projection...
            </div>
          ) : plotState.traces.length === 0 ? (
            <div className='flex h-full items-center justify-center text-sm text-black/55'>
              No cluster data is available to render the map.
            </div>
          ) : (
            <Plot
              data={plotState.traces}
              layout={layout}
              config={{
                displaylogo: false,
                responsive: true,
                scrollZoom: true,
              }}
              useResizeHandler
              onClick={(event) => {
                const songId = extractSongIdFromEvent(event);

                if (songId === null) {
                  return;
                }

                setFocusedSongId(songId);
                setFocusedSong(null);
                setFocusedSongLoading(true);
                setFocusedSongError(null);
              }}
              className='h-full w-full'
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>

        <div className='grid shrink-0 gap-4 sm:grid-cols-3 lg:h-[230px]'>
          <div className='flex min-h-0 flex-col overflow-hidden rounded-md border border-black/10 bg-white/85 p-4 shadow-[0_12px_32px_rgba(43,29,18,0.06)] lg:h-full'>
            <p className='shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/50'>
              Closest to centroid
            </p>
            {representativeSongs.error ? (
              <p className='mt-2 text-xs text-red-600'>{representativeSongs.error}</p>
            ) : (
              <div className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
                {representativeSongs.centroid.map((song) => (
                  <SongButton
                    key={`centroid-${song.id}`}
                    song={song}
                    active={focusedSong?.id === song.id}
                    onSelect={handleSelectSong}
                  />
                ))}
                {representativeSongs.loading && (
                  <p className='text-xs leading-5 text-black/55'>Loading...</p>
                )}
                {!representativeSongs.loading && representativeSongs.centroid.length === 0 && (
                  <p className='text-xs leading-5 text-black/55'>No centroid songs available yet.</p>
                )}
              </div>
            )}
          </div>

          <div className='flex min-h-0 flex-col overflow-hidden rounded-md border border-black/10 bg-white/85 p-4 shadow-[0_12px_32px_rgba(43,29,18,0.06)] lg:h-full'>
            <p className='shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/50'>
              Most viewed
            </p>
            <div className='mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1'>
              {representativeSongs.popular.map((song) => (
                <SongButton
                  key={`popular-${song.id}`}
                  song={song}
                  active={focusedSong?.id === song.id}
                  onSelect={handleSelectSong}
                />
              ))}
              {representativeSongs.loading && (
                <p className='text-xs leading-5 text-black/55'>Loading...</p>
              )}
              {!representativeSongs.loading && representativeSongs.popular.length === 0 && (
                <p className='text-xs leading-5 text-black/55'>No popular songs available yet.</p>
              )}
            </div>
          </div>

          <div className='flex min-h-0 flex-col overflow-hidden rounded-md border border-black/10 bg-white/85 p-4 shadow-[0_12px_32px_rgba(43,29,18,0.06)] lg:h-full'>
            <p className='shrink-0 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/50'>
              Song detail
            </p>
            {focusedSongError && <p className='mt-2 text-xs text-red-600'>{focusedSongError}</p>}
            <div className='mt-2 min-h-0 flex-1 overflow-y-auto pr-1'>
              {focusedSongLoading ? (
                <p className='text-xs leading-5 text-black/55'>Loading song details...</p>
              ) : focusedSong ? (
                <div>
                  <p className='truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-black/45'>
                    {focusedSong.artist}
                  </p>
                  <h3 className='mt-1 truncate text-sm font-semibold leading-5 text-black'>
                    {focusedSong.title}
                  </h3>
                  <p className='mt-2 text-xs leading-5 text-black/62'>
                    {focusedSong.tag} • {focusedSong.year ?? 'Unknown'} • {formatCount(focusedSong.views)} views
                  </p>
                  <div className='mt-2 flex flex-wrap gap-1.5'>
                    {focusedSongPath.length > 0 ? (
                      focusedSongPath.map((label) => (
                        <span
                          key={`${focusedSong.id}-${label}`}
                          className='rounded-sm border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[10px] font-medium text-black/70'
                        >
                          {label}
                        </span>
                      ))
                    ) : (
                      <span className='text-[11px] text-black/50'>No cluster path available.</span>
                    )}
                  </div>
                </div>
              ) : (
                <p className='text-xs leading-5 text-black/55'>
                  Click a point or a song card to inspect it here.
                </p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className='shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'>
            <strong>Error:</strong> {error}
          </div>
        )}
      </main>
    </div>
  );
}
