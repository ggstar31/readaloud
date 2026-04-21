import { withJsonRetry } from "@/lib/json";
import { callLLM } from "@/lib/llm";
import { FINAL_SUMMARY_SYSTEM_PROMPT } from "@/lib/prompts";

type FinalSummaryResponse = {
  summary: string;
  bridge: string;
};

export async function POST(request: Request) {
  try {
    const { title, summaries } = (await request.json()) as {
      title?: string;
      summaries?: string[];
    };

    if (!summaries?.length) {
      return Response.json(
        { error: "Section summaries are required." },
        { status: 400 }
      );
    }

    const result = await withJsonRetry<FinalSummaryResponse>((extraInstruction) =>
      callLLM({
        system: `${FINAL_SUMMARY_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
        user: `ARTICLE TITLE: ${
          title ?? "Untitled"
        }\n\nSECTION SUMMARIES:\n${summaries.join("\n")}`,
        maxTokens: 300,
        temperature: 0.3,
        jsonMode: true,
      })
    );

    return Response.json({
      summary: `${result.summary} ${result.bridge}`.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Final summary failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
