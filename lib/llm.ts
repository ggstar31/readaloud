import type { LLMProvider } from "@/types";

export type LLMRequest = {
  system: string;
  user: string;
  provider?: LLMProvider;
  maxTokens?: number;
  temperature?: number;
};

function getActiveProvider(provider?: LLMProvider): LLMProvider {
  return provider ?? (process.env.LLM_PROVIDER as LLMProvider) ?? "gemini";
}

async function readError(response: Response) {
  const text = await response.text();
  throw new Error(
    `LLM request failed (${response.status} ${response.statusText}): ${text}`
  );
}

export async function callLLM({
  system,
  user,
  provider,
  maxTokens = 1200,
  temperature = 0.3,
}: LLMRequest): Promise<string> {
  const activeProvider = getActiveProvider(provider);

  if (activeProvider === "claude") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is missing.");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!response.ok) {
      await readError(response);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text = data.content?.find((part) => part.type === "text")?.text;

    if (!text) {
      throw new Error("Claude did not return text content.");
    }

    return text;
  }

  if (activeProvider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_LLM_MODEL ?? "gpt-4o-mini",
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      await readError(response);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error("OpenAI did not return message content.");
    }

    return text;
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${
      process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    }:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    await readError(response);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini did not return content.");
  }

  return text;
}
