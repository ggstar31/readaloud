function normalizeParagraph(paragraph: string) {
  return paragraph
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/[`*_>#-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLongParagraph(paragraph: string) {
  if (paragraph.length <= 1400) {
    return [paragraph];
  }

  const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const candidate = current ? `${current} ${trimmed}` : trimmed;

    if (candidate.length > 1200 && current) {
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

export function chunkArticle(markdown: string) {
  const paragraphs = markdown
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map(normalizeParagraph)
    .filter((paragraph) => paragraph.length > 60)
    .flatMap(splitLongParagraph);

  if (!paragraphs.length) {
    return [markdown.slice(0, 1800).trim()].filter(Boolean);
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;

  for (const paragraph of paragraphs) {
    const nextLength = currentLength + paragraph.length;
    const shouldFlush =
      current.length >= 3 || (current.length >= 2 && nextLength > 1700);

    if (shouldFlush) {
      chunks.push(current.join("\n\n"));
      current = [];
      currentLength = 0;
    }

    current.push(paragraph);
    currentLength += paragraph.length;
  }

  if (current.length) {
    chunks.push(current.join("\n\n"));
  }

  return chunks.slice(0, 10);
}
