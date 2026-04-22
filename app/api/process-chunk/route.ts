import { withJsonRetry } from "@/lib/json";
import { createFallbackProcessedChunk } from "@/lib/fallback-processing";
import { callLLM } from "@/lib/llm";
import { PROCESS_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ProcessedChunk } from "@/types";

export async function POST(request: Request) {
  try {
    const { chunk } = (await request.json()) as { chunk?: string };

    if (!chunk) {
      return Response.json({ error: "Chunk text is required." }, { status: 400 });
    }

    let processed: ProcessedChunk;

    try {
      processed = await withJsonRetry<ProcessedChunk>((extraInstruction) =>
        callLLM({
          system: `${PROCESS_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
          user: chunk,
          maxTokens: 700,
          temperature: 0.35,
          jsonMode: true,
          timeoutMs: 6500,
        })
      , 0);
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

    return Response.json(processed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chunk processing failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
