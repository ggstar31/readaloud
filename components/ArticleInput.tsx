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
    <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,22,0.95),rgba(10,16,30,0.98))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
      <label
        htmlFor="article-url"
        className="mb-3 block text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/75"
      >
        Paste a public article URL
      </label>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          id="article-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://example.com/article"
          className="min-h-14 flex-1 rounded-[1.2rem] border border-white/10 bg-white/6 px-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="min-h-14 rounded-[1.2rem] bg-[linear-gradient(135deg,#f7b955,#ffd488)] px-6 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Preparing session..." : "Create audio session"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        Built for public articles. Drop in a link, press play, and explore the
        piece as a guided audio experience.
      </p>
    </div>
  );
}
