export function cleanJsonResponse(raw: string) {
  return raw.replace(/```json|```/g, "").trim();
}

export function parseJsonResponse<T>(raw: string): T {
  return JSON.parse(cleanJsonResponse(raw)) as T;
}

export async function withJsonRetry<T>(
  fn: (extraInstruction?: string) => Promise<string>,
  retries = 2
): Promise<T> {
  let extraInstruction = "";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const raw = await fn(extraInstruction);
      return parseJsonResponse<T>(raw);
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }

      extraInstruction =
        "\n\nCRITICAL: Return ONLY valid JSON. No markdown fences. No commentary.";
    }
  }

  throw new Error("Could not parse JSON response.");
}
