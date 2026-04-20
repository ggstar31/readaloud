import { withJsonRetry } from "@/lib/json";
import { callLLM } from "@/lib/llm";
import { CHUNK_SYSTEM_PROMPT } from "@/lib/prompts";

export async function POST(request: Request) {
  try {
    const { markdown, title } = (await request.json()) as {
      markdown?: string;
      title?: string;
    };

    if (!markdown) {
      return Response.json(
        { error: "Article markdown is required." },
        { status: 400 }
      );
    }

    const articlePayload = `ARTICLE TITLE: ${title ?? "Untitled"}\n\n${markdown
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, 30000)}`;

    const chunks = await withJsonRetry<string[]>((extraInstruction) =>
      callLLM({
        system: `${CHUNK_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
        user: articlePayload,
        maxTokens: 1600,
        temperature: 0.1,
      })
    );

    const sanitizedChunks = chunks
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (!sanitizedChunks.length) {
      return Response.json(
        { error: "No chunks were returned from the model." },
        { status: 500 }
      );
    }

    return Response.json({ chunks: sanitizedChunks });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chunking failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
