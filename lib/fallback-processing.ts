import type { ProcessedChunk } from "@/types";
import {
  firstSentencesForSpeech,
  limitForSpeech,
  sanitizeForSpeech,
} from "@/lib/speech-text";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "between",
  "could",
  "every",
  "from",
  "have",
  "into",
  "only",
  "other",
  "their",
  "there",
  "these",
  "they",
  "this",
  "through",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

function getTopic(text: string) {
  const words = sanitizeForSpeech(text)
    .toLowerCase()
    .match(/[a-z][a-z-]{4,}/g) ?? [];
  const counts = new Map<string, number>();

  for (const word of words) {
    if (STOP_WORDS.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([word]) => word.replace(/-/g, " "));

  return keywords.length ? keywords.join(" and ") : "the author's argument";
}

function optionText(text: string) {
  const clean = sanitizeForSpeech(text).replace(/[.!?]+$/g, "");

  if (clean.length <= 120) {
    return clean;
  }

  return `${clean.slice(0, 117).trim()}...`;
}

export function createFallbackProcessedChunk(chunk: string): ProcessedChunk {
  const narration = sanitizeForSpeech(chunk).slice(0, 2400);
  const firstIdea =
    firstSentencesForSpeech(chunk, 1) ||
    narration.slice(0, 220) ||
    "the author is building the central argument";
  const secondIdea =
    firstSentencesForSpeech(chunk, 2).replace(firstIdea, "").trim() ||
    "it connects back to the larger point of the article";
  const topic = getTopic(chunk);
  const answerIdea = optionText(firstIdea);

  return {
    narration:
      narration ||
      "This section could not be rewritten, but the article text is ready to explore.",
    summary: limitForSpeech(
      `In this section, the author develops this idea: ${firstIdea} To summarize, ${secondIdea}`,
      420
    ),
    question: `Which option best captures this section's point about ${topic}?`,
    options: [
      `A) ${answerIdea}`,
      `B) The section says ${topic} is not connected to the article's argument.`,
      "C) The section mainly lists background details without a clear claim.",
      "D) The section rejects the earlier argument and changes topic completely.",
    ],
    answer: "A",
    explanation: limitForSpeech(
      `The best answer is A because the section centers on this idea: ${answerIdea}.`,
      220
    ),
  };
}

export function createFallbackFinalSummary(title: string, summaries: string[]) {
  const usefulSummaries = summaries
    .map(sanitizeForSpeech)
    .filter(Boolean)
    .slice(0, 4);

  if (!usefulSummaries.length) {
    return `${title} is ready as an audio session. You can listen through the sections or ask questions about the article anytime.`;
  }

  return `Here is the big picture from ${title}: ${usefulSummaries.join(
    " "
  )} You can now ask follow-up questions or replay the session from the beginning.`;
}
