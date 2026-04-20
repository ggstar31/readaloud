import { callLLM } from "@/lib/llm";
import { CHAT_SYSTEM_PROMPT } from "@/lib/prompts";
import type { ChatMessage } from "@/types";

export async function POST(request: Request) {
  try {
    const { messages, articleText, title, summaries } = (await request.json()) as {
      messages?: ChatMessage[];
      articleText?: string;
      title?: string;
      summaries?: string[];
    };

    if (!messages?.length || !articleText) {
      return Response.json(
        { error: "Conversation messages and article text are required." },
        { status: 400 }
      );
    }

    const conversationHistory = messages
      .map((message) =>
        `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`
      )
      .join("\n");

    const context = `ARTICLE TITLE: ${
      title ?? "Untitled"
    }\n\nARTICLE SUMMARY:\n${(summaries ?? []).join(
      "\n"
    )}\n\nARTICLE EXCERPT:\n${articleText.slice(0, 12000)}\n\nCONVERSATION:\n${conversationHistory}`;

    const reply = await callLLM({
      system: CHAT_SYSTEM_PROMPT,
      user: context,
      maxTokens: 450,
      temperature: 0.4,
    });

    return Response.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
