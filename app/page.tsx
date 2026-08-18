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
        <div className="rounded-md border-2 border-black/15 bg-white/90 p-8 shadow-[0_10px_0_rgba(43,29,18,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/50">
            Artist Prediction
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-black sm:text-5xl">
            Match lyrics to the most likely artist.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-black/65">
            Paste a lyric excerpt below and see who the model thinks wrote it.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <textarea
          rows={5}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste or type text for BERT to analyze..."
          disabled={loading}
          className="min-h-40 w-full rounded-md border border-black/10 bg-white/90 px-5 py-4 text-base text-black outline-none transition placeholder:text-black/35 focus:border-black/30 focus:ring-4 focus:ring-black/5 disabled:cursor-not-allowed disabled:opacity-70"
        />

        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Running Inference...' : 'Analyze Text'}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
        </div>

        <aside className="rounded-md border-2 border-black/15 bg-black px-8 py-8 text-white shadow-[0_10px_0_rgba(43,29,18,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
            Explore the Dataset
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            Explore lyrical clusters in two dimensions.
          </h2>
          <p className="mt-4 text-sm leading-7 text-white/72">
            See how songs group by lyrical meaning, from broad genres down to individual tracks.
          </p>
        </aside>
      </section>

      {prediction && (
        <div className="rounded-md border-2 border-black/15 bg-white/90 p-6 shadow-[0_10px_0_rgba(43,29,18,0.08)]">
          <h3 className="mb-4 text-lg font-semibold text-black">Model Output</h3>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-black px-4 py-4 text-sm text-white">
            {JSON.stringify(prediction, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}