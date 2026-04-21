import type { ProcessedChunk } from "@/types";

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .trim();
}

function firstSentences(text: string, count: number) {
  const sentences = cleanText(text).match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  return sentences.slice(0, count).join(" ").trim();
}

export function createFallbackProcessedChunk(chunk: string): ProcessedChunk {
  const narration = cleanText(chunk).slice(0, 2400);
  const summarySeed = firstSentences(chunk, 2) || narration.slice(0, 280);

  return {
    narration:
      narration ||
      "This section could not be rewritten, but the article text is ready to explore.",
    summary: `In this section, the article develops this idea: ${summarySeed}`,
    question:
      "What is the main idea this section wants you to remember, and how does it connect to the article so far?",
  };
}

export function createFallbackFinalSummary(title: string, summaries: string[]) {
  const usefulSummaries = summaries
    .map(cleanText)
    .filter(Boolean)
    .slice(0, 4);

  if (!usefulSummaries.length) {
    return `${title} is ready as an audio session. You can listen through the sections or ask questions about the article anytime.`;
  }

  return `Here is the big picture from ${title}: ${usefulSummaries.join(
    " "
  )} You can now ask follow-up questions or replay the session from the beginning.`;
}
