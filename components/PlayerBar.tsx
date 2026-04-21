import type { PlayerState } from "@/types";

type PlayerBarProps = {
  playerState: PlayerState;
  canStart: boolean;
  canPause: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  progressPercent: number;
  insightScore: number;
  completedChunks: number;
  totalChunks: number;
  currentStage: "narration" | "summary" | "quiz" | null;
  articleTitle: string;
  finalSummary: string;
};

const stageCards = [
  {
    id: "narration",
    label: "Narration",
    helper: "Story-first listening",
  },
  {
    id: "summary",
    label: "Summary",
    helper: "Two-sentence recap",
  },
  {
    id: "quiz",
    label: "Quiz",
    helper: "Reflection prompt",
  },
] as const;

function formatStatus(playerState: PlayerState) {
  switch (playerState) {
    case "PREPARING":
      return "Preparing your audio session";
    case "READY":
      return "Ready to play";
    case "NARRATING":
      return "Now narrating";
    case "SUMMARIZING":
      return "Delivering the recap";
    case "QUIZZING":
      return "Asking the reflection prompt";
    case "CHATTING":
      return "Answering your question";
    case "ERROR":
      return "Needs another try";
    default:
      return "Waiting for an article";
  }
}

export function PlayerBar({
  playerState,
  canStart,
  canPause,
  onStart,
  onPause,
  onReset,
  progressPercent,
  insightScore,
  completedChunks,
  totalChunks,
  currentStage,
  articleTitle,
  finalSummary,
}: PlayerBarProps) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(7,10,20,0.96))] p-6 text-slate-50 shadow-[0_24px_120px_rgba(0,0,0,0.45)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">
            Session
          </p>
          <h2 className="mt-2 text-3xl font-semibold">Audio briefing deck</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">
            Listen, get a crisp recap, hear a quick quiz prompt, then jump into
            conversation whenever curiosity strikes.
          </p>
        </div>
        <div className="rounded-full border border-cyan-300/15 bg-cyan-300/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
          {formatStatus(playerState)}
        </div>
      </div>

      <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Current article
            </p>
            <p className="mt-2 text-lg font-semibold text-white">
              {articleTitle || "No article loaded yet"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart}
              className="rounded-full bg-[#f7b955] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffd07c] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {playerState === "READY" ? "Play session" : "Resume"}
            </button>
            <button
              type="button"
              onClick={onPause}
              disabled={!canPause}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pause
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

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
              <span>Progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#00d9ff,#66f3c8,#f7b955)] transition-[width] duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Insight score
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {insightScore}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Climbs as the listener finishes sections and explores follow-up
                  questions.
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-white/8 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Sections
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {completedChunks}/{totalChunks || 0}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Each section cycles through narration, summary, and quiz mode.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-cyan-300/10 bg-cyan-300/6 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
              Session flow
            </p>
            <div className="mt-4 grid gap-3">
              {stageCards.map((stage) => {
                const active = currentStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    className={`rounded-[1.1rem] border px-4 py-4 transition ${
                      active
                        ? "border-cyan-300/50 bg-cyan-300/14 text-white"
                        : "border-white/8 bg-white/5 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold">{stage.label}</p>
                      {active ? (
                        <span className="rounded-full bg-cyan-200/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          Live
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6">{stage.helper}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {finalSummary ? (
        <div className="mt-6 rounded-[1.5rem] border border-emerald-300/10 bg-emerald-300/6 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
            Wrap-up
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-200">{finalSummary}</p>
        </div>
      ) : null}
    </section>
  );
}
