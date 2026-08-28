import labelMap from '@/public/label_map.json';

type PredictionResultProps = {
  predictedClass: number;
  confidenceScores: number[];
};

const CLASS_TO_ARTIST: Record<number, string> = Object.fromEntries(
  Object.entries(labelMap).map(([name, index]) => [index, name])
);

const TOP_N = 5;

export default function PredictionResult({ predictedClass, confidenceScores }: PredictionResultProps) {
  if (!Array.isArray(confidenceScores) || confidenceScores.length === 0) {
    return (
      <p className="text-sm text-black/60">Prediction data was malformed and could not be displayed.</p>
    );
  }

  const predictedArtist = CLASS_TO_ARTIST[predictedClass] ?? 'Unrecognized artist';

  const ranked = confidenceScores
    .map((score, index) => ({ artist: CLASS_TO_ARTIST[index] ?? `Class ${index}`, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/50">Predicted Artist</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-accent">{predictedArtist}</p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-black/50">Top Matches</p>
        {ranked.map(({ artist, score }) => {
          const percentage = score * 100;
          return (
            <div key={artist} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-black">{artist}</span>
                <span className="text-black/60">{percentage.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
