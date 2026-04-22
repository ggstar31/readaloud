import type { PlayerState } from "@/types";

type PlayerBarProps = {
  playerState: PlayerState;
  canStart: boolean;
  canPause: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
  progressPercent: number;
  insightScore: number;
  completedChunks: number;
  totalChunks: number;
  currentStage: "narration" | "summary" | "quiz" | null;
  articleTitle: string;
  finalSummary: string;
  displayText: string;
  listenerName: string;
};

const stageCopy = {
  narration: {
    label: "Narration",
    dot: "bg-violet-400",
    helper: "Story-first listening",
  },
  summary: {
    label: "Recaps",
    dot: "bg-cyan-300",
    helper: "Fast memory lock",
  },
  quiz: {
    label: "Checkpoint",
    dot: "bg-amber-300",
    helper: "Earn IQ",
  },
} as const;

function statusFor(playerState: PlayerState) {
  switch (playerState) {
    case "PREPARING":
      return "TUNING";
    case "READY":
      return "READY";
    case "NARRATING":
      return "NOW PLAYING";
    case "SUMMARIZING":
      return "RECAPS";
    case "QUIZZING":
      return "CHECKPOINT";
    case "CHATTING":
      return "ASKING";
    case "ERROR":
      return "TRY AGAIN";
    default:
      return "IDLE";
  }
}

export function PlayerBar({
  playerState,
  canStart,
  canPause,
  onStart,
  onPause,
  onReset,
  onPrevious,
  onNext,
  progressPercent,
  insightScore,
  completedChunks,
  totalChunks,
  currentStage,
  articleTitle,
  finalSummary,
  displayText,
  listenerName,
}: PlayerBarProps) {
  const activeStage = currentStage ? stageCopy[currentStage] : stageCopy.narration;
  const isPlaying =
    playerState === "NARRATING" ||
    playerState === "SUMMARIZING" ||
    playerState === "QUIZZING";

  return (
    <section className="app-glass relative overflow-hidden rounded-[2rem] p-4 text-white sm:rounded-[2.35rem] sm:p-6">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />

      <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={onReset}
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-2xl text-white/80 transition hover:bg-white/16"
          aria-label="Reset session"
        >
          ‹
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.35em] text-violet-300">
            {statusFor(playerState)}
          </p>
          <h2 className="truncate text-lg font-black tracking-tight text-white">
            {articleTitle || "Drop a link to begin"}
          </h2>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white sm:block">
          {listenerName || "Reader"}
        </div>
        <div className="text-right text-lg font-black text-white">
          {insightScore}
          <span className="ml-1 text-sm text-white/55">IQ</span>
        </div>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-300 to-amber-200 transition-[width] duration-700"
          style={{ width: `${Math.max(3, progressPercent)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-end text-sm font-bold tracking-[0.16em] text-white/55">
        Paragraph {Math.min(completedChunks + 1, totalChunks || 1)} / {totalChunks || 1}
      </div>

      <div className="relative mx-auto mt-6 grid h-56 max-w-sm place-items-center sm:mt-9 sm:h-80">
        <div className="orb-ring absolute h-56 w-56 rounded-full border border-cyan-300/18 sm:h-72 sm:w-72" />
        <div className="orb-ring absolute h-44 w-44 rounded-full border border-violet-400/22 [animation-delay:500ms] sm:h-56 sm:w-56" />
        <div className="absolute h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl sm:h-44 sm:w-44" />
        <div className="orb-core relative h-36 w-36 rounded-full bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.55),transparent_22%),linear-gradient(135deg,#a78bfa_0%,#6d5dfc_42%,#22d3ee_100%)] shadow-[0_30px_90px_rgba(34,211,238,0.34)] sm:h-52 sm:w-52">
          <div className="absolute left-8 top-7 h-9 w-20 rounded-full bg-white/24 blur-[1px] sm:left-10 sm:top-8 sm:h-12 sm:w-24" />
          <div className="absolute inset-10 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="mx-auto -mt-2 flex w-fit items-center gap-3 rounded-full border border-white/12 bg-white/[0.08] px-6 py-3 text-sm font-black uppercase tracking-[0.32em]">
        <span className={`h-3 w-3 rounded-full ${activeStage.dot}`} />
        {activeStage.label}
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#17122b]/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:mt-7 sm:rounded-[1.75rem] sm:p-6">
        <p className="text-lg font-black leading-7 tracking-tight text-white sm:text-2xl sm:leading-10">
          {displayText ||
            finalSummary ||
            activeStage.helper ||
            "Drop in an article and ReadAloud will turn it into a guided audio experience."}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-center gap-5 sm:mt-6 sm:gap-7">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!totalChunks}
          className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/10 text-xl text-white shadow-lg transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-45 sm:h-16 sm:w-16 sm:text-2xl"
          aria-label="Previous paragraph"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={isPlaying ? onPause : onStart}
          disabled={!canStart && !canPause}
          className="grid h-20 w-20 place-items-center rounded-full bg-[linear-gradient(135deg,#a855f7,#22d3ee)] text-3xl font-black text-white shadow-[0_25px_70px_rgba(124,58,237,0.45)] transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 sm:h-24 sm:w-24 sm:text-4xl"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!totalChunks}
          className="grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-white/10 text-xl text-white shadow-lg transition hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-50 sm:h-16 sm:w-16 sm:text-2xl"
          aria-label="Next paragraph"
        >
          ▶
        </button>
      </div>
    </section>
  );
}
