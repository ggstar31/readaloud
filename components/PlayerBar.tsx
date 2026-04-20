import type { PlayerState } from "@/types";

type PlayerBarProps = {
  playerState: PlayerState;
  canStart: boolean;
  onStart: () => void;
  onReset: () => void;
  score: {
    correct: number;
    total: number;
  };
  audioCount: number;
};

export function PlayerBar({
  playerState,
  canStart,
  onStart,
  onReset,
  score,
  audioCount,
}: PlayerBarProps) {
  const isBusy =
    playerState === "SCRAPING" ||
    playerState === "CHUNKING" ||
    playerState === "PROCESSING";

  return (
    <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-black/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Controls
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Start playback after the article is prepared, or reset the session
            any time.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || isBusy}
            className="rounded-full bg-cyan-100 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {playerState === "READY" ? "Start listening" : "Resume flow"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Quiz score
          </div>
          <div className="mt-2 text-2xl font-semibold">
            {score.correct}/{score.total}
          </div>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Cached audio
          </div>
          <div className="mt-2 text-2xl font-semibold">{audioCount}</div>
        </div>
        <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Current mode
          </div>
          <div className="mt-2 text-lg font-semibold">{playerState}</div>
        </div>
      </div>
    </div>
  );
}
