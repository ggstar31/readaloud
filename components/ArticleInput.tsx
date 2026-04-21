type ArticleInputProps = {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
};

export function ArticleInput({
  url,
  onUrlChange,
  onSubmit,
  isLoading,
}: ArticleInputProps) {
  return (
    <div className="app-glass rounded-[2rem] p-5">
      <label
        htmlFor="article-url"
        className="mb-3 block text-[11px] font-black uppercase tracking-[0.32em] text-violet-200/80"
      >
        Paste article URL
      </label>
      <div className="flex flex-col gap-4">
        <div className="flex min-h-14 items-center gap-3 rounded-[1.35rem] border border-white/10 bg-white/[0.07] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <span className="text-xl text-violet-200">↔</span>
          <input
            id="article-url"
            type="url"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://wired.com/neural-interfaces"
            className="min-h-14 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-400"
          />
          {url ? (
            <button
              type="button"
              onClick={() => onUrlChange("")}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/12 text-sm text-slate-300 transition hover:bg-white/20"
              aria-label="Clear URL"
            >
              ×
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="min-h-16 rounded-[1.45rem] bg-[linear-gradient(135deg,#a855f7_0%,#6d5dfc_45%,#22d3ee_100%)] px-6 text-lg font-black text-white shadow-[0_22px_60px_rgba(124,58,237,0.42)] transition hover:scale-[1.01] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="mr-3 inline-block">{isLoading ? "◇" : "▶"}</span>
          {isLoading ? "Preparing experience" : "Start listening"}
        </button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm font-black text-white">
        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-3">
          Hands free
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-3">
          Recaps
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-3">
          Earn IQ
        </div>
      </div>
    </div>
  );
}
