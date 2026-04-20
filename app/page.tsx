"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArticleInput } from "@/components/ArticleInput";
import { ChatDrawer } from "@/components/ChatDrawer";
import { PlayerBar } from "@/components/PlayerBar";
import { QuizCard } from "@/components/QuizCard";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type {
  Article,
  ChatMessage,
  PlayerState,
  ProcessedChunk,
  QuizFeedback,
  SegmentType,
} from "@/types";

const playerLabels: Record<PlayerState, string> = {
  IDLE: "Paste a public article URL to begin.",
  SCRAPING: "Pulling the clean article body with Firecrawl.",
  CHUNKING: "Breaking the article into listenable sections.",
  PROCESSING: "Writing narration, recap, and quiz moments.",
  READY: "The article is prepared. Press play to start listening.",
  NARRATING: "Reading the current section aloud.",
  SUMMARIZING: "Playing the short recap for this section.",
  QUIZZING: "Asking the comprehension check.",
  FEEDBACK: "Giving immediate feedback on your answer.",
  CHATTING: "Article complete. Conversation mode is unlocked.",
  ERROR: "Something went wrong. See the error note below.",
};

type VisibleTranscript = {
  narration?: string;
  summary?: string;
  question?: string;
  feedback?: string;
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
      // Ignore invalid error bodies and fall back to the generic message.
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
      // Ignore invalid error bodies and fall back to the generic message.
    }
    throw new Error(message);
  }

  return response.blob();
}

function cacheKey(index: number, type: SegmentType) {
  return `chunk_${index}_${type}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [chunks, setChunks] = useState<string[]>([]);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>("IDLE");
  const [currentChunk, setCurrentChunk] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedbackByChunk, setFeedbackByChunk] = useState<
    Record<number, QuizFeedback>
  >({});
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [finalSummary, setFinalSummary] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const [visibleTranscript, setVisibleTranscript] = useState<VisibleTranscript>(
    {}
  );
  const [isPreparing, startPreparingTransition] = useTransition();
  const [isChatting, startChatTransition] = useTransition();
  const chunkAdvanceTimeoutRef = useRef<number | null>(null);
  const playChunkSegmentRef = useRef<
    ((index: number, type: SegmentType) => Promise<void>) | null
  >(null);

  const { audioCache, ensureAudio, playUrl, stop } = useAudioPlayer();

  const currentProcessedChunk = processedChunks[currentChunk];
  const currentFeedback = feedbackByChunk[currentChunk];

  const canStartPlayback =
    processedChunks.length > 0 &&
    (playerState === "READY" ||
      playerState === "NARRATING" ||
      playerState === "SUMMARIZING" ||
      playerState === "QUIZZING" ||
      playerState === "FEEDBACK");

  const progressLabel = useMemo(() => {
    if (!processedChunks.length) {
      return "No article loaded yet";
    }

    return `Section ${currentChunk + 1} of ${processedChunks.length}`;
  }, [currentChunk, processedChunks.length]);

  useEffect(() => {
    return () => {
      if (chunkAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(chunkAdvanceTimeoutRef.current);
      }
    };
  }, []);

  const fetchSegmentAudio = useCallback(async (
    index: number,
    type: SegmentType,
    text: string,
    instructions: string
  ) => {
    const key = cacheKey(index, type);

    return ensureAudio(key, async () => {
      const blob = await postAudio("/api/tts", {
        text,
        instructions,
      });
      return blob;
    });
  }, [ensureAudio]);

  const prefetchChunkAudio = useCallback(async (index: number) => {
    const chunk = processedChunks[index];

    if (!chunk) {
      return;
    }

    await Promise.all([
      fetchSegmentAudio(
        index,
        "narration",
        chunk.narration,
        "Speak naturally, warmly, and with steady pacing for focused listening."
      ),
      fetchSegmentAudio(
        index,
        "summary",
        chunk.summary,
        "Speak as a concise recap that reinforces the key point."
      ),
      fetchSegmentAudio(
        index,
        "question",
        `${chunk.question} ${chunk.options.join(" ")}`,
        "Speak clearly like a friendly tutor asking a multiple-choice question."
      ),
    ]);
  }, [fetchSegmentAudio, processedChunks]);

  const playChunkSegment = useCallback(async (index: number, type: SegmentType) => {
    const chunk = processedChunks[index];

    if (!chunk) {
      return;
    }

    const payloadMap: Record<
      SegmentType,
      { text: string; instructions: string; state: PlayerState }
    > = {
      narration: {
        text: chunk.narration,
        instructions:
          "Narrate like a thoughtful podcast host. Keep it clear, smooth, and energetic enough to hold attention.",
        state: "NARRATING",
      },
      summary: {
        text: chunk.summary,
        instructions:
          "Give a short recap in a grounded, confident tone that feels easy to follow.",
        state: "SUMMARIZING",
      },
      question: {
        text: `${chunk.question} ${chunk.options.join(" ")}`,
        instructions:
          "Ask this like a quiz host. Leave a small pause between each answer option.",
        state: "QUIZZING",
      },
      feedback: {
        text: feedbackByChunk[index]?.feedback ?? "",
        instructions:
          "Respond like a supportive teacher giving short, spoken feedback.",
        state: "FEEDBACK",
      },
    };

    const payload = payloadMap[type];

    if (!payload.text) {
      return;
    }

    setPlayerState(payload.state);

    if (type === "narration") {
      setVisibleTranscript({
        narration: chunk.narration,
        summary: chunk.summary,
        question: chunk.question,
        feedback: feedbackByChunk[index]?.feedback,
      });
    }

    if (type === "feedback") {
      setVisibleTranscript((previous) => ({
        ...previous,
        feedback: payload.text,
      }));
    }

    const urlToPlay = await fetchSegmentAudio(
      index,
      type,
      payload.text,
      payload.instructions
    );

    await playUrl(urlToPlay, () => {
      if (type === "narration") {
        void playChunkSegmentRef.current?.(index, "summary");
        return;
      }

      if (type === "summary") {
        window.setTimeout(() => {
          void playChunkSegmentRef.current?.(index, "question");
        }, 450);
        return;
      }

      if (type === "question") {
        setPlayerState("QUIZZING");
        return;
      }

      if (type === "feedback") {
        if (index === processedChunks.length - 1) {
          setPlayerState("CHATTING");
          return;
        }

        const nextIndex = index + 1;
        chunkAdvanceTimeoutRef.current = window.setTimeout(() => {
          setCurrentChunk(nextIndex);
          void playChunkSegmentRef.current?.(nextIndex, "narration");
        }, 700);
      }
    });

    if (type === "narration") {
      void prefetchChunkAudio(index + 1);
    }
  }, [feedbackByChunk, fetchSegmentAudio, playUrl, prefetchChunkAudio, processedChunks]);

  useEffect(() => {
    if (playerState === "READY" && currentChunk === 0 && processedChunks.length) {
      void prefetchChunkAudio(0);
    }
  }, [currentChunk, playerState, prefetchChunkAudio, processedChunks.length]);

  useEffect(() => {
    playChunkSegmentRef.current = playChunkSegment;
  }, [playChunkSegment]);

  async function handlePrepareArticle() {
    if (!url.trim()) {
      setError("Please enter a valid article URL.");
      return;
    }

    setError("");
    stop();
    setPlayerState("SCRAPING");
    setCurrentChunk(0);
    setSelectedAnswer(null);
    setFeedbackByChunk({});
    setScore({ correct: 0, total: 0 });
    setFinalSummary("");
    setVisibleTranscript({});
    setChatMessages([]);

    startPreparingTransition(async () => {
      try {
        const scraped = await postJson<Article>("/api/scrape", {
          url: url.trim(),
        });
        setArticle(scraped);
        setPlayerState("CHUNKING");

        const chunkResponse = await postJson<{ chunks: string[] }>("/api/chunk", {
          markdown: scraped.markdown,
          title: scraped.title,
        });
        setChunks(chunkResponse.chunks);

        setPlayerState("PROCESSING");
        const processed = await Promise.all(
          chunkResponse.chunks.map((chunk) =>
            postJson<ProcessedChunk>("/api/process-chunk", { chunk })
          )
        );
        setProcessedChunks(processed);

        const summaryResponse = await postJson<{ summary: string }>(
          "/api/final-summary",
          {
            title: scraped.title,
            summaries: processed.map((item) => item.summary),
          }
        );
        setFinalSummary(summaryResponse.summary);
        setPlayerState("READY");
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Something went wrong while preparing the article.";
        setError(message);
        setPlayerState("ERROR");
      }
    });
  }

  async function handleStartPlayback() {
    if (!processedChunks.length) {
      return;
    }

    setSelectedAnswer(null);
    await playChunkSegment(currentChunk, "narration");
  }

  async function handleSubmitAnswer(option: string) {
    const chunk = processedChunks[currentChunk];

    if (!chunk || playerState !== "QUIZZING") {
      return;
    }

    setSelectedAnswer(option);

    try {
      const feedback = await postJson<QuizFeedback>("/api/evaluate", {
        question: chunk.question,
        options: chunk.options,
        correctAnswer: chunk.answer,
        explanation: chunk.explanation,
        userAnswer: option,
      });

      setFeedbackByChunk((previous) => ({
        ...previous,
        [currentChunk]: feedback,
      }));
      setScore((previous) => ({
        correct: previous.correct + (feedback.correct ? 1 : 0),
        total: previous.total + 1,
      }));
      await playChunkSegment(currentChunk, "feedback");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not evaluate the answer.";
      setError(message);
      setPlayerState("ERROR");
    }
  }

  async function handleSendChat(message: string) {
    if (!article) {
      return;
    }

    const nextMessages = [
      ...chatMessages,
      {
        role: "user" as const,
        content: message,
      },
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

        const key = `chat_${Date.now()}`;
        const urlToPlay = await ensureAudio(key, async () => {
          return postAudio("/api/tts", {
            text: response.reply,
            instructions:
              "Speak conversationally, like a smart reading companion answering a follow-up question.",
          });
        });

        await playUrl(urlToPlay);
      } catch (requestError) {
        const message =
          requestError instanceof Error
            ? requestError.message
            : "Chat could not be completed.";
        setError(message);
      }
    });
  }

  function handleReset() {
    stop();
    setArticle(null);
    setChunks([]);
    setProcessedChunks([]);
    setPlayerState("IDLE");
    setCurrentChunk(0);
    setSelectedAnswer(null);
    setFeedbackByChunk({});
    setScore({ correct: 0, total: 0 });
    setFinalSummary("");
    setChatMessages([]);
    setVisibleTranscript({});
    setError("");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#173a4e,transparent_38%),linear-gradient(180deg,#f4eee1_0%,#efe6d4_55%,#e9deca_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_24px_100px_rgba(23,58,78,0.12)] backdrop-blur">
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <span className="inline-flex rounded-full border border-slate-300/70 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
                  ReadAloud v1
                </span>
                <h1 className="mt-4 max-w-3xl font-sans text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Turn any public article into a narrated lesson, one chunk at a
                  time.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
                  The app scrapes the article, rewrites it for listening,
                  delivers spoken recaps, checks comprehension with MCQs, and
                  finishes with a conversational reading companion.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-[#143445] px-4 py-3 text-sm text-slate-50 shadow-sm">
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">
                  Build logic
                </div>
                <div className="mt-2 max-w-xs leading-6">
                  Firecrawl cleans the page, an LLM prepares each chunk, and
                  OpenAI speech turns the result into audio.
                </div>
              </div>
            </div>

            <ArticleInput
              url={url}
              onUrlChange={setUrl}
              onSubmit={handlePrepareArticle}
              isLoading={isPreparing}
            />

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200 bg-[#f9f5ec] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 1
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Scrape and clean only the main article body.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-[#f7efe0] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 2
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Convert each section into narration, recap, and quiz prompts.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-[#eef6f6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Step 3
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Read it aloud, check understanding, then open article chat.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-[#102c39] p-6 text-slate-50 shadow-[0_24px_100px_rgba(23,58,78,0.18)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                  Session state
                </p>
                <h2 className="mt-2 text-2xl font-semibold">Playback control</h2>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                {progressLabel}
              </span>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-sm leading-7 text-slate-200">
                {playerLabels[playerState]}
              </p>
              {article ? (
                <div className="mt-5 space-y-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
                      Current article
                    </div>
                    <div className="mt-1 text-lg font-semibold">{article.title}</div>
                  </div>
                  <div className="text-sm leading-6 text-slate-300">
                    {chunks.length
                      ? `${chunks.length} chunks prepared for audio-first learning.`
                      : "Waiting for article preparation to finish."}
                  </div>
                </div>
              ) : null}
            </div>

            <PlayerBar
              playerState={playerState}
              canStart={canStartPlayback}
              onStart={handleStartPlayback}
              onReset={handleReset}
              score={score}
              audioCount={Object.keys(audioCache).length}
            />

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Why this build is cost-aware</p>
                <span className="rounded-full bg-cyan-100/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-cyan-100">
                  v1 choice
                </span>
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <li>We process small chunks instead of one huge article prompt.</li>
                <li>We prefetch audio progressively instead of generating every MP3 upfront.</li>
                <li>MCQ grading is deterministic, so we avoid an extra model call there.</li>
              </ul>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.5rem] border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
          <TranscriptPanel
            article={article}
            visibleTranscript={visibleTranscript}
            finalSummary={finalSummary}
            playerState={playerState}
          />

          <div className="space-y-6">
            <QuizCard
              chunk={currentProcessedChunk}
              feedback={currentFeedback}
              playerState={playerState}
              onAnswer={handleSubmitAnswer}
              selectedAnswer={selectedAnswer}
            />

            <ChatDrawer
              messages={chatMessages}
              isEnabled={playerState === "CHATTING"}
              isSending={isChatting}
              onSend={handleSendChat}
              articleTitle={article?.title ?? ""}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
