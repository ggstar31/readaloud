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
    <div className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
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
          className="min-h-14 flex-1 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 text-base text-white outline-none placeholder:text-slate-400 focus:border-cyan-300"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="min-h-14 rounded-[1.2rem] bg-[#f4b860] px-6 text-sm font-semibold text-slate-950 transition hover:bg-[#f2ae47] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Preparing article..." : "Build listening session"}
        </button>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        V1 targets public web articles only. The voice the user hears should be
        disclosed as AI-generated in production.
      </p>
    </div>
  );
}
