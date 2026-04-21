import { withJsonRetry } from "@/lib/json";
import { createFallbackFinalSummary } from "@/lib/fallback-processing";
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

    let result: FinalSummaryResponse;

    try {
      result = await withJsonRetry<FinalSummaryResponse>((extraInstruction) =>
        callLLM({
          system: `${FINAL_SUMMARY_SYSTEM_PROMPT}${extraInstruction ?? ""}`,
          user: `ARTICLE TITLE: ${
            title ?? "Untitled"
          }\n\nSECTION SUMMARIES:\n${summaries.join("\n")}`,
          maxTokens: 300,
          temperature: 0.3,
          jsonMode: true,
          timeoutMs: 6500,
        })
      , 0);
    } catch (error) {
      console.error("LLM final summary failed, using fallback.", error);
      result = {
        summary: createFallbackFinalSummary(title ?? "this article", summaries),
        bridge: "",
      };
    }

    return Response.json({
      summary: `${result.summary} ${result.bridge}`.trim(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Final summary failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
