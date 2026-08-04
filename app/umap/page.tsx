'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import type { Data, Layout } from 'plotly.js';

import { getUmapData } from '@/app/utils/loadData';

const Plot = dynamic(() => import('react-plotly.js'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[560px] items-center justify-center rounded-[2rem] border border-black/10 bg-white/70 text-sm text-black/55 dark:border-white/10 dark:bg-white/10 dark:text-white/55">
      Loading Plotly renderer...
    </div>
  ),
});

type UmapPoint = {
  id: string | number;
  title: string;
  tag: string;
  artist: string;
  year: number | string;
  views: number | string;
  level_1: string;
  level_2: string;
  x: number;
  y: number;
};

const palette = [
  '#0f172a',
  '#1d4ed8',
  '#0891b2',
  '#059669',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#db2777',
  '#ea580c',
  '#334155',
];

export default function UmapPage() {
  const [points, setPoints] = useState<UmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPoints() {
      try {
        setLoading(true);
        setError(null);

        const rawData = await getUmapData();
        const rows = Array.isArray(rawData) ? rawData : rawData?.data;

        if (!Array.isArray(rows)) {
          throw new Error('UMAP data response must be an array of rows.');
        }

        const normalized = rows
          .map((row) => ({
            ...row,
            x: Number(row.x),
            y: Number(row.y),
          }))
          .filter((row) => Number.isFinite(row.x) && Number.isFinite(row.y));

        if (!cancelled) {
          setPoints(normalized as UmapPoint[]);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load UMAP data.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPoints();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = new Map<string, UmapPoint[]>();
  for (const point of points) {
    const key = point.tag || 'Unlabeled';
    const existing = grouped.get(key);

    if (existing) {
      existing.push(point);
    } else {
      grouped.set(key, [point]);
    }
  }

  const traces: Data[] = Array.from(grouped.entries()).map(([tag, rows], index) => ({
    type: 'scattergl',
    mode: 'markers',
    name: tag,
    x: rows.map((row) => row.x),
    y: rows.map((row) => row.y),
    text: rows.map((row) => row.title),
    customdata: rows.map((row) => [
      row.artist,
      row.tag,
      row.year,
      row.views,
      row.level_1,
      row.level_2,
      row.id,
    ]),
    hovertemplate:
      '<b>%{text}</b><br>' +
      'Artist: %{customdata[0]}<br>' +
      'Tag: %{customdata[1]}<br>' +
      'Year: %{customdata[2]}<br>' +
      'Views: %{customdata[3]}<br>' +
      'Level 1: %{customdata[4]}<br>' +
      'Level 2: %{customdata[5]}<br>' +
      'ID: %{customdata[6]}<extra></extra>',
    marker: {
      size: 7,
      opacity: 0.72,
      color: palette[index % palette.length],
      line: {
        width: 0,
      },
    },
  }));

  const layout: Partial<Layout> = {
    title: undefined,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(255,255,255,0.65)',
    dragmode: 'pan',
    hovermode: 'closest',
    legend: {
      orientation: 'h',
      y: 1.14,
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
      gridcolor: 'rgba(15, 23, 42, 0.08)',
    },
    yaxis: {
      title: {
        text: 'UMAP Y',
      },
      zeroline: false,
      gridcolor: 'rgba(15, 23, 42, 0.08)',
    },
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/10 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/50 dark:text-white/50">
            UMAP Projection
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black dark:text-white sm:text-5xl">
            Explore how songs cluster by meaning.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-black/65 dark:text-white/70">
            Each point is a song lyric embedded into a two-dimensional UMAP space. The chart uses Plotly&apos;s WebGL-backed <span className="font-mono text-sm">scattergl</span> trace mode so large point clouds stay responsive.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-black/70 dark:text-white/72">
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
              Color groups are based on the <span className="font-mono text-xs">tag</span> column.
            </div>
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 dark:border-white/10 dark:bg-white/[0.06]">
              Hover any point to inspect title, artist, year, views, and hierarchy levels.
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-black px-8 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white dark:text-black dark:shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55 dark:text-black/45">
                Points Loaded
              </dt>
              <dd className="mt-2 text-3xl font-semibold">{points.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55 dark:text-black/45">
                Tag Groups
              </dt>
              <dd className="mt-2 text-3xl font-semibold">{grouped.size.toLocaleString()}</dd>
            </div>
          </dl>
          <p className="mt-8 text-sm leading-7 text-white/72 dark:text-black/70">
            Data is loaded in the browser through the existing cache-aware loader, so revisiting the page can reuse the cached response instead of hitting the API every time.
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-[560px] items-center justify-center rounded-[2rem] border border-black/10 bg-white/70 text-sm text-black/55 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/10 dark:text-white/55 dark:shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          Loading UMAP points...
        </div>
      ) : (
        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <Plot
            data={traces}
            layout={layout}
            config={{
              displaylogo: false,
              responsive: true,
              scrollZoom: true,
            }}
            useResizeHandler
            className="h-[600px] w-full"
            style={{ width: '100%', height: '600px' }}
          />
        </div>
      )}
    </div>
  );
}