import { withJsonRetry } from "@/lib/json";
import { createFallbackProcessedChunk } from "@/lib/fallback-processing";
import { callLLM } from "@/lib/llm";
import { PROCESS_SYSTEM_PROMPT } from "@/lib/prompts";
import { limitForSpeech, sanitizeForSpeech } from "@/lib/speech-text";
import type { ProcessedChunk } from "@/types";

function normalizeProcessedChunk(processed: ProcessedChunk): ProcessedChunk {
  return {
    narration: sanitizeForSpeech(processed.narration),
    summary: limitForSpeech(processed.summary, 520),
    question: sanitizeForSpeech(processed.question),
    options: processed.options?.map(sanitizeForSpeech),
    answer: processed.answer,
    explanation: limitForSpeech(processed.explanation ?? "", 240),
  };
}

export async function POST(request: Request) {
  try {
    const { chunk } = (await request.json()) as { chunk?: string };

    if (!chunk) {
      return Response.json({ error: "Chunk text is required." }, { status: 400 });
    }

    let processed: ProcessedChunk;

    try {
      processed = await withJsonRetry<ProcessedChunk>(
        (extraInstruction) =>
          callLLM({
            system: `${PROCESS_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
            user: chunk,
            maxTokens: 950,
            temperature: 0.45,
            jsonMode: true,
            timeoutMs: 12000,
          }),
        1
      );
    } catch (error) {
      console.error("LLM chunk processing failed, using fallback.", error);
      processed = createFallbackProcessedChunk(chunk);
    }

    if (
      !processed.narration ||
      !processed.summary ||
      !processed.question ||
      !processed.options?.length ||
      !processed.answer ||
      !processed.explanation
    ) {
      processed = createFallbackProcessedChunk(chunk);
    }

    return Response.json(normalizeProcessedChunk(processed));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chunk processing failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
