'use client';
import React, { useState } from 'react';

type PredictionResult = Record<string, unknown>;

export default function Predictor() {
  const [inputText, setInputText] = useState('');
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setPrediction(null);

    try {
      // Hit Vercel internal API endpoint instead of Modal directly
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(data.error || 'Something went wrong running inference.');
        // throw new Error(data.error || 'Something went wrong running inference.');
      }

      // Set your result state (adjust 'data.prediction' depending on your exact Modal output schema)
      setPrediction(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong running inference.';
      console.error(message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/10 dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/50 dark:text-white/50">
            Artist Prediction
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black dark:text-white sm:text-5xl">
            Match lyrics to the most likely artist.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-black/65 dark:text-white/70">
            Paste a lyric excerpt to run your existing classifier. Use the navigation above to switch to the UMAP lyrics map and explore how songs cluster by semantic similarity.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <textarea
          rows={5}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or type text for BERT to analyze..."
          disabled={loading}
          className="min-h-40 w-full rounded-3xl border border-black/10 bg-white/90 px-5 py-4 text-base text-black outline-none transition placeholder:text-black/35 focus:border-black/30 focus:ring-4 focus:ring-black/5 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-black/20 dark:text-white dark:placeholder:text-white/35 dark:focus:border-white/25 dark:focus:ring-white/10"
        />

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/85 disabled:cursor-not-allowed disabled:bg-black/25 dark:bg-white dark:text-black dark:hover:bg-white/85 dark:disabled:bg-white/20"
        >
          {loading ? 'Running Inference...' : 'Analyze Text'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          <strong>Error:</strong> {error}
        </div>
      )}
        </div>

        <aside className="rounded-[2rem] border border-black/10 bg-black px-8 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white dark:text-black dark:shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55 dark:text-black/45">
            Explore the Dataset
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Visualize lyrical meaning in two dimensions.
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/72 dark:text-black/70">
            The new map page plots each song using its UMAP coordinates (`x`, `y`) and groups points by label so you can inspect semantic neighborhoods with fast WebGL rendering.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-white/80 dark:text-black/75">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 dark:border-black/10 dark:bg-black/6">
              Hover details include title, artist, tag, year, views, and hierarchy levels.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 dark:border-black/10 dark:bg-black/6">
              Cached fetches reuse the existing browser-side loader for quicker revisits.
            </div>
          </div>
        </aside>
      </section>

      {prediction && (
        <div className="rounded-[2rem] border border-black/10 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/10 dark:shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
          <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">Model Output</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-slate-950 px-4 py-4 text-sm text-slate-100">
            {JSON.stringify(prediction, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}