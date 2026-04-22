export type LLMProvider = "claude" | "openai" | "gemini";

export type PlayerState =
  | "IDLE"
  | "PREPARING"
  | "READY"
  | "NARRATING"
  | "SUMMARIZING"
  | "CHECKPOINT"
  | "QUIZZING"
  | "FEEDBACK"
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
  options?: string[];
  answer?: "A" | "B" | "C" | "D";
  explanation?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ListeningSession = {
  id: string;
  article: Article;
  processedChunks: ProcessedChunk[];
  currentChunk: number;
  completedChunks: number;
  finalSummary: string;
  chatMessages: ChatMessage[];
  insightScore: number;
  correctQuizCount?: number;
  updatedAt: string;
};
