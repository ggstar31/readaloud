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

type Scraper = () => Promise<Article>;

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

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 10))
    );
}

function extractTitle(html: string) {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i
  )?.[1];
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  return decodeEntities((ogTitle ?? titleTag ?? "Untitled article").trim());
}

function extractBodyCandidate(html: string) {
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (articleMatch) {
    return articleMatch;
  }

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (mainMatch) {
    return mainMatch;
  }

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  return bodyMatch ?? html;
}

function normalizeFetchedHtml(html: string) {
  const body = extractBodyCandidate(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<button[\s\S]*?<\/button>/gi, "")
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|main|blockquote|h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ");

  return decodeEntities(body)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function scrapeWithFirecrawl(url: string): Promise<Article> {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY is missing.");
  }

  const response = await fetchWithTimeout(
    "https://api.firecrawl.dev/v1/scrape",
    {
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
    },
    9000
  );

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

async function scrapeWithDirectFetch(url: string): Promise<Article> {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    },
    4500
  );

  if (!response.ok) {
    throw new Error(`Direct fetch failed with status ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error("Direct fetch did not return HTML.");
  }

  const html = await response.text();
  const title = extractTitle(html);
  const markdown = normalizeFetchedHtml(html);

  if (!markdown || markdown.length < 900) {
    throw new Error("Direct fetch could not extract enough article text.");
  }

  if (looksLikeErrorPage(title, markdown)) {
    throw new Error("Direct fetch found a blocked or error page.");
  }

  return {
    markdown,
    title,
    description: "",
    url: response.url || url,
  };
}

async function firstSuccessful(scrapers: Scraper[]) {
  const errors: string[] = [];

  return new Promise<Article>((resolve, reject) => {
    let pending = scrapers.length;

    for (const scrape of scrapers) {
      void scrape()
        .then(resolve)
        .catch((error) => {
          errors.push(error instanceof Error ? error.message : "Unknown scrape failure.");
          pending -= 1;

          if (pending === 0) {
            reject(new Error(errors.join(" | ")));
          }
        });
    }
  });
}

export async function scrapeArticle(url: string): Promise<Article> {
  const scrapers: Scraper[] = [() => scrapeWithDirectFetch(url)];

  if (process.env.FIRECRAWL_API_KEY) {
    scrapers.push(() => scrapeWithFirecrawl(url));
  }

  if (!scrapers.length) {
    throw new Error("FIRECRAWL_API_KEY is missing.");
  }

  return firstSuccessful(scrapers);
}
