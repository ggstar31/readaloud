const SPEECH_INPUT_LIMIT = 2600;

export async function POST(request: Request) {
  try {
    const { text, instructions } = (await request.json()) as {
      text?: string;
      instructions?: string;
    };

    if (!text?.trim()) {
      return Response.json({ error: "Text is required." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is missing." },
        { status: 500 }
      );
    }

    const input = text.replace(/\s+/g, " ").trim();

    if (input.length > SPEECH_INPUT_LIMIT) {
      return Response.json(
        {
          error:
            "Text is too long for one speech request. The client should split it before calling TTS.",
        },
        { status: 413 }
      );
    }

    const preferredModel = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
    const preferredVoice = process.env.OPENAI_TTS_VOICE ?? "coral";

    async function createSpeech() {
      const preferred = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: preferredModel,
          voice: preferredVoice,
          input,
          instructions:
            instructions ??
            "Speak in a warm, clear, feminine narration style for attentive listening.",
          response_format: "mp3",
        }),
      });

      if (preferred.ok) {
        return preferred;
      }

      const preferredError = await preferred.text();

      const fallback = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: "coral",
          input,
          response_format: "mp3",
        }),
      });

      if (!fallback.ok) {
        const fallbackError = await fallback.text();
        throw new Error(
          `OpenAI TTS failed. Preferred: ${preferredError}. Fallback: ${fallbackError}`
        );
      }

      return fallback;
    }

    const response = await createSpeech();

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TTS failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
