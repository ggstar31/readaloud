import type { PlayerState, ProcessedChunk, QuizFeedback } from "@/types";

type QuizCardProps = {
  chunk?: ProcessedChunk;
  feedback?: QuizFeedback;
  playerState: PlayerState;
  selectedAnswer: string | null;
  onAnswer: (option: string) => void;
};

export function QuizCard({
  chunk,
  feedback,
  playerState,
  selectedAnswer,
  onAnswer,
}: QuizCardProps) {
  const canAnswer = playerState === "QUIZZING";

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/75 p-6 shadow-[0_24px_100px_rgba(23,58,78,0.12)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
        Comprehension check
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-950">
        Multiple-choice checkpoint
      </h2>

      <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-[#f9f5ec] p-5">
        <p className="text-sm leading-7 text-slate-700">
          {chunk?.question ??
            "Each chunk ends with one multiple-choice question to keep listening active instead of passive."}
        </p>

        <div className="mt-5 grid gap-3">
          {chunk?.options.map((option) => {
            const letter = option.charAt(0);
            const isSelected = selectedAnswer === letter;

            return (
              <button
                key={option}
                type="button"
                onClick={() => onAnswer(letter)}
                disabled={!canAnswer}
                className={`rounded-[1.2rem] border px-4 py-4 text-left text-sm leading-6 transition ${
                  isSelected
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                } disabled:cursor-not-allowed disabled:opacity-65`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-[#eef6f6] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          Latest feedback
        </p>
        <p className="mt-3 text-sm leading-7 text-slate-700">
          {feedback?.feedback ??
            "The app speaks a short explanation immediately after the user chooses an answer."}
        </p>
      </div>
    </section>
  );
}
