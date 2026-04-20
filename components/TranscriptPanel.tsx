import type { Article, PlayerState } from "@/types";

type TranscriptPanelProps = {
  article: Article | null;
  visibleTranscript: {
    narration?: string;
    summary?: string;
    question?: string;
    feedback?: string;
  };
  finalSummary: string;
  playerState: PlayerState;
};

export function TranscriptPanel({
  article,
  visibleTranscript,
  finalSummary,
  playerState,
}: TranscriptPanelProps) {
  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/75 p-6 shadow-[0_24px_100px_rgba(23,58,78,0.12)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Transcript view
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            What the listener is hearing
          </h2>
        </div>
        {article ? (
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Open source article
          </a>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4">
        <article className="rounded-[1.6rem] border border-slate-200 bg-[#f9f5ec] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Narration
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {visibleTranscript.narration ??
              "The prepared narration will appear here once playback starts."}
          </p>
        </article>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.6rem] border border-slate-200 bg-[#eef6f6] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Section recap
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {visibleTranscript.summary ??
                "After each narrated chunk, the app gives a 2-sentence spoken recap."}
            </p>
          </article>

          <article className="rounded-[1.6rem] border border-slate-200 bg-[#f7efe0] p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              Quiz prompt
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-700">
              {visibleTranscript.question ??
                "The current multiple-choice question shows up here once the recap ends."}
            </p>
          </article>
        </div>

        <article className="rounded-[1.6rem] border border-slate-200 bg-slate-950 p-5 text-slate-50">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Spoken feedback
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-200">
            {visibleTranscript.feedback ??
              "The answer feedback will appear here immediately after the listener responds."}
          </p>
        </article>

        <article className="rounded-[1.6rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
              End-of-article summary
            </p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
              {playerState === "CHATTING" ? "Ready" : "Preparing"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {finalSummary ||
              "Once processing finishes, the app prepares a final summary to bridge into chat mode."}
          </p>
        </article>
      </div>
    </section>
  );
}
