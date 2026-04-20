import { scrapeArticle } from "@/lib/firecrawl";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url) {
      return Response.json({ error: "URL is required." }, { status: 400 });
    }

    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return Response.json(
        { error: "Only http and https URLs are supported." },
        { status: 400 }
      );
    }

    const article = await scrapeArticle(url);
    return Response.json(article);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scrape article.";
    return Response.json({ error: message }, { status: 500 });
  }
}
