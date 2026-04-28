function normalizeParagraph(paragraph: string) {
  return paragraph
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitIntoSentences(paragraph: string) {
  return paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
}

function splitLongParagraph(paragraph: string) {
  const sentences = splitIntoSentences(paragraph);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const candidate = current ? `${current} ${trimmed}` : trimmed;

    if (candidate.length > 520 && current) {
      chunks.push(current);
      current = trimmed;
      continue;
    }

    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function groupShortSections(paragraphs: string[]) {
  const chunks: string[] = [];
  let currentSentences: string[] = [];
  let currentLength = 0;

  const flush = () => {
    if (!currentSentences.length) {
      return;
    }

    chunks.push(currentSentences.join(" ").trim());
    currentSentences = [];
    currentLength = 0;
  };

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph)
      .map((sentence) => sentence.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const nextLength = currentLength + sentence.length + (currentSentences.length ? 1 : 0);
      const shouldFlush =
        currentSentences.length >= 4 ||
        (currentSentences.length >= 3 && nextLength > 360) ||
        nextLength > 460;

      if (shouldFlush) {
        flush();
      }

      currentSentences.push(sentence);
      currentLength += sentence.length + (currentSentences.length > 1 ? 1 : 0);
    }

    if (currentSentences.length >= 3) {
      flush();
    }
  }

  flush();
  return chunks;
}

export function chunkArticle(markdown: string) {
  const paragraphs = markdown
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map(normalizeParagraph)
    .filter((paragraph) => paragraph.length > 60)
    .flatMap(splitLongParagraph);

  if (!paragraphs.length) {
    return [markdown.slice(0, 700).trim()].filter(Boolean);
  }

  return groupShortSections(paragraphs).slice(0, 18);
}
