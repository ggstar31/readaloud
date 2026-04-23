const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((?:https?:\/\/|www\.)[^)]+\)/gi;
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\([^)]+\)/gi;
const EMAIL_PATTERN = /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const TITLE_PREFIX_PATTERN =
  /\b(?:article title|source|source url|permalink|url|link)\s*:\s*/gi;

export function sanitizeForSpeech(text: string) {
  return text
    .replace(MARKDOWN_IMAGE_PATTERN, "")
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(URL_PATTERN, "")
    .replace(EMAIL_PATTERN, "")
    .replace(TITLE_PREFIX_PATTERN, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\((?:ibid|source|link|url)[^)]*\)/gi, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function firstSentencesForSpeech(text: string, count: number) {
  const clean = sanitizeForSpeech(text);
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];

  return sentences.slice(0, count).join(" ").trim();
}

export function limitForSpeech(text: string, maxLength = 520) {
  const clean = sanitizeForSpeech(text);

  if (clean.length <= maxLength) {
    return clean;
  }

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
  let output = "";

  for (const sentence of sentences) {
    const candidate = output ? `${output} ${sentence.trim()}` : sentence.trim();

    if (candidate.length > maxLength) {
      break;
    }

    output = candidate;
  }

  return output || `${clean.slice(0, maxLength).trim()}...`;
}
