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

  return {
    markdown: result.data.markdown,
    title: result.data.metadata?.title ?? "Untitled article",
    description: result.data.metadata?.description ?? "",
    url: result.data.metadata?.sourceURL ?? url,
  };
}
