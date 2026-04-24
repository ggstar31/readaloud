type ArticleInputProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onPause: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  canResume: boolean;
  hasPreparedSession: boolean;
};

export function ArticleInput({
  url,
  onUrlChange,
  onSubmit,
  onPause,
  isLoading,
  isPlaying,
  canResume,
  hasPreparedSession,
}: ArticleInputProps) {
  const ctaLabel = isLoading
    ? "Preparing experience"
    : isPlaying
      ? "Pause listening"
      : hasPreparedSession && canResume
        ? "Resume listening"
        : "Start listening";
  const ctaIcon = isLoading ? "◇" : isPlaying ? "Ⅱ" : "▶";
  const handlePrimaryAction = isPlaying ? onPause : onSubmit;

  return (
    <div className="app-glass overflow-hidden rounded-[1.6rem] p-4 sm:rounded-[2rem] sm:p-5">
      <label
        htmlFor="article-url"
        className="mb-3 block text-[10px] font-black uppercase tracking-[0.28em] text-violet-200/80 sm:text-[11px] sm:tracking-[0.32em]"
      >
        Paste article URL
      </label>
      <div className="flex flex-col gap-4">
        <div className="flex min-h-14 w-full min-w-0 items-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/[0.07] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:gap-3 sm:rounded-[1.35rem] sm:px-4">
          <span className="shrink-0 text-lg text-violet-200 sm:text-xl">↔</span>
          <input
            id="article-url"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://wired.com/neural-interfaces"
            className="min-h-14 min-w-0 flex-1 truncate bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400 sm:text-base"
          />
          {url ? (
            <button
              type="button"
              onClick={() => onUrlChange("")}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/12 text-sm text-slate-300 transition hover:bg-white/20"
              aria-label="Clear URL"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={isLoading}
          className="min-h-14 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#a855f7_0%,#6d5dfc_45%,#22d3ee_100%)] px-4 text-base font-black text-white shadow-[0_22px_60px_rgba(124,58,237,0.42)] transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:min-h-16 sm:rounded-[1.45rem] sm:px-6 sm:text-lg"
        >
          <span className="mr-3 inline-block">{ctaIcon}</span>
          {ctaLabel}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-white sm:mt-5 sm:gap-3 sm:text-sm">
        <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-3">
          Hands free
        </div>
        <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-3">
          Recaps
        </div>
        <div className="min-w-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-3">
          Earn IQ
        </div>
      </div>
    </div>
  );
}
