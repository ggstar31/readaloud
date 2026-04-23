import type { Article } from "@/types";

type FirecrawlResponse = {
  success?: boolean;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      description?: string;
      sourceURL?: string;
    };
  };
  error?: string;
};

function looksLikeErrorPage(title: string, markdown: string) {
  const normalizedTitle = title.toLowerCase();
  const normalized = markdown.toLowerCase().replace(/\s+/g, " ");

  const titleSignals =
    normalizedTitle.includes("not found") ||
    normalizedTitle.includes("404") ||
    normalizedTitle.includes("access denied") ||
    normalizedTitle.includes("error");

  const bodySignals =
    normalized.includes("page does not exist") ||
    normalized.includes("this page does not exist") ||
    normalized.includes("404") ||
    normalized.includes("not found") ||
    normalized.includes("access denied") ||
    normalized.includes("temporarily unavailable");

  const tooShort = markdown.trim().length < 400;

  return (titleSignals && bodySignals) || (tooShort && bodySignals);
}

export async function scrapeArticle(url: string): Promise<Article> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is missing.");
  }

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      excludeTags: ["nav", "footer", "header", "aside", "script", "style"],
      blockAds: true,
      maxAge: 3600000,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firecrawl request failed: ${text}`);
  }

  const result = (await response.json()) as FirecrawlResponse;

  if (!result.success || !result.data?.markdown) {
    throw new Error(result.error ?? "Firecrawl could not scrape the article.");
  }

  const title = result.data.metadata?.title ?? "Untitled article";
  const markdown = result.data.markdown ?? "";

  if (looksLikeErrorPage(title, markdown)) {
    throw new Error(
      "Firecrawl scraped a non-article page (likely 404 or blocked). Please try another URL."
    );
  }

  return {
    markdown,
    title,
    description: result.data.metadata?.description ?? "",
    url: result.data.metadata?.sourceURL ?? url,
  };
}
