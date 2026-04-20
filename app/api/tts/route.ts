const SPEECH_INPUT_LIMIT = 3200;

function splitForSpeech(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (clean.length <= SPEECH_INPUT_LIMIT) {
    return [clean];
  }

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > SPEECH_INPUT_LIMIT && current) {
      chunks.push(current);
      current = sentence.trim();
      continue;
    }
    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

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

    const parts = splitForSpeech(text);
    const audioBuffers: Uint8Array[] = [];

    for (const part of parts) {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
          voice: process.env.OPENAI_TTS_VOICE ?? "nova",
          input: part,
          instructions:
            instructions ?? "Speak naturally and clearly for attentive listening.",
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        return Response.json({ error: message }, { status: 500 });
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      audioBuffers.push(bytes);
    }

    const merged = new Uint8Array(
      audioBuffers.reduce((sum, current) => sum + current.length, 0)
    );
    let offset = 0;

    for (const chunk of audioBuffers) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return new Response(merged, {
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
