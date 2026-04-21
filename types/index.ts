export type LLMProvider = "claude" | "openai" | "gemini";

export type PlayerState =
  | "IDLE"
  | "PREPARING"
  | "READY"
  | "NARRATING"
  | "SUMMARIZING"
  | "QUIZZING"
  | "CHATTING"
  | "ERROR";

export type SegmentType = "narration" | "summary" | "question" | "chat";

export type Article = {
  title: string;
  description: string;
  markdown: string;
  url: string;
};

export type ProcessedChunk = {
  narration: string;
  summary: string;
  question: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
