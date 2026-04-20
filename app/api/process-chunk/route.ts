import { withJsonRetry } from "@/lib/json";
import { callLLM } from "@/lib/llm";
import { PROCESS_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ProcessedChunk } from "@/types";

export async function POST(request: Request) {
  try {
    const { chunk } = (await request.json()) as { chunk?: string };

    if (!chunk) {
      return Response.json({ error: "Chunk text is required." }, { status: 400 });
    }

    const processed = await withJsonRetry<ProcessedChunk>((extraInstruction) =>
      callLLM({
        system: `${PROCESS_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
        user: chunk,
        maxTokens: 900,
        temperature: 0.35,
      })
    );

    if (!Array.isArray(processed.options) || processed.options.length !== 4) {
      return Response.json(
        { error: "Model output did not include four answer options." },
        { status: 500 }
      );
    }

    return Response.json(processed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chunk processing failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
