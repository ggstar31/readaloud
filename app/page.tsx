"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArticleInput } from "@/components/ArticleInput";
import { ChatDrawer } from "@/components/ChatDrawer";
import { PlayerBar } from "@/components/PlayerBar";
import { mapWithConcurrency } from "@/lib/async";
import {
  createFallbackFinalSummary,
  createFallbackProcessedChunk,
} from "@/lib/fallback-processing";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { Article, ChatMessage, PlayerState, ProcessedChunk, SegmentType } from "@/types";

type Stage = "narration" | "summary" | "quiz" | null;
type PlaybackSegmentType = Exclude<SegmentType, "chat">;

const friendlyStatus: Record<PlayerState, string> = {
  IDLE: "Drop in a public article and we’ll turn it into a cinematic audio briefing.",
  PREPARING: "Preparing a guided listening session from the article.",
  READY: "Your session is ready. Hit play whenever you want.",
  NARRATING: "The story is playing now.",
  SUMMARIZING: "A fast recap is coming through.",
  QUIZZING: "A quick reflection prompt is live.",
  CHATTING: "The companion is answering your question aloud.",
  ERROR: "We hit a hiccup preparing this article. Try again or switch to another public link.",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Fall back to generic message when the body is not JSON.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function postAudio(url: string, body: unknown): Promise<Blob> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Audio generation failed.";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // Fall back to generic message when the body is not JSON.
    }
    throw new Error(message);
  }

  return response.blob();
}

function cacheKey(index: number, type: SegmentType) {
  return `chunk_${index}_${type}`;
}

function formatError(message: string) {
  if (/api_key|no llm provider key|key is missing/i.test(message)) {
    return "The narration AI keys are not set correctly in Vercel yet. Update the environment variables, redeploy, and try again.";
  }

  if (/429|rate/i.test(message)) {
    return "The AI provider is temporarily rate-limiting this request. Wait a few seconds and try again.";
  }

  if (/firecrawl/i.test(message)) {
    return "The article text could not be cleaned correctly. Try another public article URL.";
  }

  return "This article could not be turned into an audio session yet. Try another public article or retry after redeploying with updated API settings.";
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>("IDLE");
  const [currentStage, setCurrentStage] = useState<Stage>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [finalSummary, setFinalSummary] = useState("");
  const [error, setError] = useState("");
  const [isPreparing, startPreparingTransition] = useTransition();
  const [isChatting, startChatTransition] = useTransition();
  const playbackTimeoutRef = useRef<number | null>(null);
  const playChunkSegmentRef = useRef<
    ((index: number, type: PlaybackSegmentType) => Promise<void>) | null
  >(null);

  const { ensureAudio, playUrl, stop } = useAudioPlayer();

  const progressPercent = useMemo(() => {
    if (!processedChunks.length) {
      return 0;
    }

    const stageFraction =
      currentStage === "narration" ? 0.2 : currentStage === "summary" ? 0.55 : currentStage === "quiz" ? 0.9 : 0;

    return Math.min(
      100,
      ((completedChunks + stageFraction) / processedChunks.length) * 100
    );
  }, [completedChunks, currentStage, processedChunks.length]);

  const insightScore = useMemo(() => {
    const questionCount = chatMessages.filter((message) => message.role === "user").length;
    return Math.min(99, completedChunks * 11 + questionCount * 7 + (article ? 8 : 0));
  }, [article, chatMessages, completedChunks]);

  const canStart =
    processedChunks.length > 0 &&
    (playerState === "READY" ||
      playerState === "NARRATING" ||
      playerState === "SUMMARIZING" ||
      playerState === "QUIZZING" ||
      playerState === "CHATTING");

  const canPause =
    playerState === "NARRATING" ||
    playerState === "SUMMARIZING" ||
    playerState === "QUIZZING" ||
    playerState === "CHATTING";

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, []);

  const fetchSegmentAudio = useCallback(
    async (index: number, type: SegmentType, text: string, instructions: string) => {
      const key = cacheKey(index, type);

      return ensureAudio(key, async () => {
        const blob = await postAudio("/api/tts", {
          text,
          instructions,
        });
        return blob;
      });
    },
    [ensureAudio]
  );

  const prefetchChunkAudio = useCallback(
    async (index: number) => {
      const chunk = processedChunks[index];

      if (!chunk) {
        return;
      }

      await Promise.all([
        fetchSegmentAudio(
          index,
          "narration",
          chunk.narration,
          "Narrate like a modern podcast host. Clear, rich, and immersive."
        ),
        fetchSegmentAudio(
          index,
          "summary",
          chunk.summary,
          "Speak like a sharp recap after a brilliant section."
        ),
        fetchSegmentAudio(
          index,
          "question",
          chunk.question,
          "Ask this like an intelligent game prompt with a little suspense."
        ),
      ]);
    },
    [fetchSegmentAudio, processedChunks]
  );

  const playChunkSegment = useCallback(
    async (index: number, type: PlaybackSegmentType) => {
      const chunk = processedChunks[index];

      if (!chunk) {
        return;
      }

      const payloadMap: Record<
        PlaybackSegmentType,
        { text: string; instructions: string; state: PlayerState; stage: Stage }
      > = {
        narration: {
          text: chunk.narration,
          instructions:
            "Narrate like a thoughtful podcast host. Keep it elegant, energetic, and easy to follow.",
          state: "NARRATING",
          stage: "narration",
        },
        summary: {
          text: chunk.summary,
          instructions:
            "Speak this recap with confidence and a calm, polished delivery.",
          state: "SUMMARIZING",
          stage: "summary",
        },
        question: {
          text: chunk.question,
          instructions:
            "Ask this like a reflective quiz host. End with a short pause for thought.",
          state: "QUIZZING",
          stage: "quiz",
        },
      };

      const payload = payloadMap[type];
      setCurrentChunk(index);
      setCurrentStage(payload.stage);
      setPlayerState(payload.state);

      const audioUrl = await fetchSegmentAudio(
        index,
        type,
        payload.text,
        payload.instructions
      );

      await playUrl(audioUrl, () => {
        if (type === "narration") {
          playbackTimeoutRef.current = window.setTimeout(() => {
            void playChunkSegmentRef.current?.(index, "summary");
          }, 250);
          return;
        }

        if (type === "summary") {
          playbackTimeoutRef.current = window.setTimeout(() => {
            void playChunkSegmentRef.current?.(index, "question");
          }, 250);
          return;
        }

        setCompletedChunks(index + 1);
        setCurrentStage(null);

        if (index >= processedChunks.length - 1) {
          setPlayerState("READY");
          return;
        }

        playbackTimeoutRef.current = window.setTimeout(() => {
          void playChunkSegmentRef.current?.(index + 1, "narration");
        }, 900);
      });

      if (type === "narration") {
        void prefetchChunkAudio(index + 1);
      }
    },
    [fetchSegmentAudio, playUrl, prefetchChunkAudio, processedChunks]
  );

  useEffect(() => {
    playChunkSegmentRef.current = playChunkSegment;
  }, [playChunkSegment]);

  useEffect(() => {
    if (playerState === "READY" && currentChunk === 0 && processedChunks.length) {
      void prefetchChunkAudio(0);
    }
  }, [currentChunk, playerState, prefetchChunkAudio, processedChunks.length]);

  async function handlePrepareArticle() {
    if (!url.trim()) {
      setError("Please enter a valid article URL.");
      return;
    }

    setError("");
    stop();
    setArticle(null);
    setProcessedChunks([]);
    setCurrentChunk(0);
    setCompletedChunks(0);
    setCurrentStage(null);
    setFinalSummary("");
    setChatMessages([]);
    setPlayerState("PREPARING");

    startPreparingTransition(async () => {
      try {
        const scraped = await postJson<Article>("/api/scrape", {
          url: url.trim(),
        });
        setArticle(scraped);

        const chunkResponse = await postJson<{ chunks: string[] }>("/api/chunk", {
          markdown: scraped.markdown,
          title: scraped.title,
        });

        const processed = await mapWithConcurrency(
          chunkResponse.chunks,
          2,
          async (chunk) => {
            try {
              return await postJson<ProcessedChunk>("/api/process-chunk", { chunk });
            } catch (processError) {
              console.warn("Chunk API failed, using client fallback.", processError);
              return createFallbackProcessedChunk(chunk);
            }
          }
        );
        setProcessedChunks(processed);

        const summaries = processed.map((item) => item.summary);
        try {
          const summaryResponse = await postJson<{ summary: string }>(
            "/api/final-summary",
            {
              title: scraped.title,
              summaries,
            }
          );
          setFinalSummary(summaryResponse.summary);
        } catch (summaryError) {
          console.warn("Final summary API failed, using client fallback.", summaryError);
          setFinalSummary(createFallbackFinalSummary(scraped.title, summaries));
        }
        setChatMessages([
          {
            role: "assistant",
            content:
              "Your article is ready. Start the session, or ask me something about it right away.",
          },
        ]);
        setPlayerState("READY");
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong while preparing the article.";
        console.error(requestError);
        setError(formatError(message));
        setPlayerState("ERROR");
      }
    });
  }

  async function handleStartPlayback() {
    if (!processedChunks.length) {
      return;
    }

    await playChunkSegment(currentChunk, "narration");
  }

  function handlePause() {
    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }
    setCurrentStage(null);
    if (processedChunks.length) {
      setPlayerState("READY");
    }
  }

  async function handleSendChat(message: string) {
    if (!article) {
      return;
    }

    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }
    if (processedChunks.length) {
      setPlayerState("READY");
      setCurrentStage(null);
    }

    const nextMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: message },
    ];
    setChatMessages(nextMessages);

    startChatTransition(async () => {
      try {
        const response = await postJson<{ reply: string }>("/api/chat", {
          messages: nextMessages,
          articleText: article.markdown,
          title: article.title,
          summaries: processedChunks.map((chunk) => chunk.summary),
        });

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.reply,
        };

        setChatMessages((previous) => [...previous, assistantMessage]);
        setPlayerState("CHATTING");

        const audioUrl = await ensureAudio(`chat_${Date.now()}`, async () =>
          postAudio("/api/tts", {
            text: response.reply,
            instructions:
              "Speak like an articulate reading companion answering a curious listener.",
          })
        );

        await playUrl(audioUrl);

        if (processedChunks.length) {
          setPlayerState("READY");
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "Chat failed.";
        console.error(requestError);
        setError(formatError(message));
        setPlayerState("ERROR");
      }
    });
  }

  function handleReset() {
    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }
    setArticle(null);
    setProcessedChunks([]);
    setCurrentChunk(0);
    setCompletedChunks(0);
    setCurrentStage(null);
    setChatMessages([]);
    setFinalSummary("");
    setError("");
    setPlayerState("IDLE");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1c2d4b_0%,rgba(28,45,75,0)_26%),radial-gradient(circle_at_85%_20%,rgba(219,39,119,0.22),transparent_22%),linear-gradient(180deg,#070b16_0%,#0a1021_52%,#05070e_100%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,32,0.92),rgba(7,10,20,0.98))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <span className="inline-flex rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  ReadAloud
                </span>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                  Turn any public article into a dark-mode audio quest.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  A link becomes a narrated experience with elegant recaps,
                  reflection prompts, live Q&amp;A, and a progress system that feels
                  more like a game than a reader.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-fuchsia-300/15 bg-fuchsia-300/8 px-4 py-3 text-sm text-fuchsia-50">
                <div className="text-xs uppercase tracking-[0.2em] text-fuchsia-100/70">
                  Live status
                </div>
                <div className="mt-2 max-w-xs leading-6">
                  {friendlyStatus[playerState]}
                </div>
              </div>
            </div>

            <div className="mt-8">
              <ArticleInput
                url={url}
                onUrlChange={setUrl}
                onSubmit={handlePrepareArticle}
                isLoading={isPreparing}
              />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Stage one
                </p>
                <p className="mt-3 text-xl font-semibold text-white">Narration</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  The article is rewritten for the ear, not the eye.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Stage two
                </p>
                <p className="mt-3 text-xl font-semibold text-white">Summary</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Every section lands with a fast, memorable recap.
                </p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Stage three
                </p>
                <p className="mt-3 text-xl font-semibold text-white">Quiz</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  A quick reflection prompt keeps the listener mentally in the game.
                </p>
              </div>
            </div>

            {error ? (
              <div className="mt-6 rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-sm leading-7 text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <PlayerBar
            playerState={playerState}
            canStart={canStart}
            canPause={canPause}
            onStart={handleStartPlayback}
            onPause={handlePause}
            onReset={handleReset}
            progressPercent={progressPercent}
            insightScore={insightScore}
            completedChunks={completedChunks}
            totalChunks={processedChunks.length}
            currentStage={currentStage}
            articleTitle={article?.title ?? ""}
            finalSummary={finalSummary}
          />
        </section>

        <ChatDrawer
          messages={chatMessages}
          isEnabled={Boolean(article)}
          isSending={isChatting}
          onSend={handleSendChat}
          articleTitle={article?.title ?? ""}
        />
      </div>
    </main>
  );
}
