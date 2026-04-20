import type { QuizFeedback } from "@/types";

export async function POST(request: Request) {
  try {
    const { correctAnswer, explanation, userAnswer } = (await request.json()) as {
      correctAnswer?: string;
      explanation?: string;
      userAnswer?: string;
    };

    if (!correctAnswer || !userAnswer) {
      return Response.json(
        { error: "Both correctAnswer and userAnswer are required." },
        { status: 400 }
      );
    }

    const normalizedCorrect = correctAnswer.trim().toUpperCase();
    const normalizedUser = userAnswer.trim().toUpperCase();
    const correct = normalizedCorrect === normalizedUser;

    const payload: QuizFeedback = correct
      ? {
          correct: true,
          feedback: `Nice work. ${explanation ?? "You picked the right concept."}`,
        }
      : {
          correct: false,
          feedback: `Not quite. The right answer was ${normalizedCorrect}. ${
            explanation ?? "Listen for the main idea in that section."
          }`,
        };

    return Response.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evaluation failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
