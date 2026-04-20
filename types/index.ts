export type LLMProvider = "claude" | "openai" | "gemini";

export type PlayerState =
  | "IDLE"
  | "SCRAPING"
  | "CHUNKING"
  | "PROCESSING"
  | "READY"
  | "NARRATING"
  | "SUMMARIZING"
  | "QUIZZING"
  | "FEEDBACK"
  | "CHATTING"
  | "ERROR";

export type SegmentType = "narration" | "summary" | "question" | "feedback";

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
  options: [string, string, string, string];
  answer: "A" | "B" | "C" | "D";
  explanation: string;
};

export type QuizFeedback = {
  correct: boolean;
  feedback: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
