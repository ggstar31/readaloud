type ListenerEvent = {
  name?: string;
  articleTitle?: string;
  articleUrl?: string;
  iqScore?: number;
  completedSections?: number;
  event?: string;
};

const ALLOWED_EVENTS = new Set([
  "profile_saved",
  "article_prepared",
  "session_progress",
  "session_completed",
]);

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;
}

export async function POST(request: Request) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_SECRET;

  if (!webhookUrl || !secret) {
    return Response.json({
      ok: false,
      skipped: true,
      reason: "Google Sheets tracking is not configured.",
    });
  }

  try {
    const body = (await request.json()) as ListenerEvent;
    const event = cleanText(body.event, 80);
    const safeEvent = ALLOWED_EVENTS.has(event) ? event : "profile_saved";

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        name: cleanText(body.name, 120),
        articleTitle: cleanText(body.articleTitle, 300),
        articleUrl: cleanText(body.articleUrl, 500),
        iqScore: cleanNumber(body.iqScore),
        completedSections: cleanNumber(body.completedSections),
        event: safeEvent,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Google Sheets tracking failed.", detail.slice(0, 500));
      return Response.json({ ok: false, skipped: true });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Listener tracking failed.", error);
    return Response.json({ ok: false, skipped: true });
  }
}
