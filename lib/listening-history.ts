import type { ListeningSession } from "@/types";

export const LISTENER_NAME_KEY = "readaloud.listenerName";
export const LISTENING_HISTORY_KEY = "readaloud.listeningHistory";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function normalizeSession(session: ListeningSession): ListeningSession {
  const total = session.processedChunks.length;

  return {
    ...session,
    currentChunk: Math.max(0, Math.min(session.currentChunk, Math.max(total - 1, 0))),
    completedChunks: Math.max(0, Math.min(session.completedChunks, total)),
  };
}

export function makeSessionId(url: string) {
  return `article-${encodeURIComponent(url).slice(0, 90)}`;
}

export function loadListenerName() {
  if (!canUseStorage()) {
    return "";
  }

  return window.localStorage.getItem(LISTENER_NAME_KEY) ?? "";
}

export function saveListenerName(name: string) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(LISTENER_NAME_KEY, name.trim());
}

export function loadListeningHistory(): ListeningSession[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LISTENING_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as ListeningSession[]) : [];

    return parsed
      .filter((session) => session.article && session.processedChunks?.length)
      .map(normalizeSession)
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
  } catch {
    return [];
  }
}

export function saveListeningSession(session: ListeningSession) {
  if (!canUseStorage()) {
    return;
  }

  const normalized = normalizeSession(session);
  const existing = loadListeningHistory().filter((item) => item.id !== normalized.id);
  const next = [normalized, ...existing].slice(0, 18);

  window.localStorage.setItem(LISTENING_HISTORY_KEY, JSON.stringify(next));
}
