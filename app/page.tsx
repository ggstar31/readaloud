"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArticleInput } from "@/components/ArticleInput";
import { ChatDrawer } from "@/components/ChatDrawer";
import { PlayerBar } from "@/components/PlayerBar";
import { mapWithConcurrency } from "@/lib/async";
import {
  createFallbackFinalSummary,
  createFallbackProcessedChunk,
} from "@/lib/fallback-processing";
import {
  loadListenerName,
  loadListeningHistory,
  makeSessionId,
  saveListenerName,
  saveListeningSession,
} from "@/lib/listening-history";
import { limitForSpeech, sanitizeForSpeech } from "@/lib/speech-text";
import { useBrowserSpeech } from "@/hooks/useBrowserSpeech";
import type {
  Article,
  ChatMessage,
  ListeningSession,
  PlayerState,
  ProcessedChunk,
  SegmentType,
} from "@/types";

type Stage =
  | "narration"
  | "summary"
  | "checkpoint"
  | "quiz"
  | "feedback"
  | "complete"
  | null;
type PlaybackSegmentType = Exclude<SegmentType, "chat">;
type Checkpoint = { startIndex: number; endIndex: number } | null;
type QuizFeedback = { correct: boolean; text: string } | null;

type ListenerEvent = {
  name: string;
  articleTitle?: string;
  articleUrl?: string;
  iqScore?: number;
  completedSections?: number;
  event:
    | "profile_saved"
    | "article_prepared"
    | "session_progress"
    | "session_completed";
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

async function waitForChunk(
  index: number,
  getChunks: () => ProcessedChunk[],
  timeoutMs = 12000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const chunk = getChunks()[index];
    if (chunk) {
      return chunk;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }

  throw new Error("The next section is still preparing. Please try again in a moment.");
}

function trackListenerEvent(payload: ListenerEvent) {
  void fetch("/api/track-listener", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((error) => {
    console.warn("Listener tracking skipped.", error);
  });
}

function formatError(message: string) {
  if (/api_key|no llm provider key|key is missing/i.test(message)) {
    return "The narration AI keys are not set correctly in Vercel yet. Update the environment variables, redeploy, and try again.";
  }

  if (/429|rate/i.test(message)) {
    return "The AI provider is temporarily rate-limiting this request. Wait a few seconds and try again.";
  }

  if (/firecrawl/i.test(message)) {
    return "That link looks like a 404 / blocked page, not a real article. Please try another public article URL.";
  }

  return "This article could not be turned into an audio session yet. Try another public article or retry after redeploying with updated API settings.";
}

export default function Home() {
  const [listenerName, setListenerName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [hasLoadedProfile, setHasLoadedProfile] = useState(false);
  const [url, setUrl] = useState("");
  const [article, setArticle] = useState<Article | null>(null);
  const [processedChunks, setProcessedChunks] = useState<ProcessedChunk[]>([]);
  const [totalChunkCount, setTotalChunkCount] = useState(0);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [completedChunks, setCompletedChunks] = useState(0);
  const [playerState, setPlayerState] = useState<PlayerState>("IDLE");
  const [currentStage, setCurrentStage] = useState<Stage>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [finalSummary, setFinalSummary] = useState("");
  const [error, setError] = useState("");
  const [savedSessions, setSavedSessions] = useState<ListeningSession[]>([]);
  const [pendingCheckpoint, setPendingCheckpoint] = useState<Checkpoint>(null);
  const [checkpointRecapText, setCheckpointRecapText] = useState("");
  const [completionMessage, setCompletionMessage] = useState("");
  const [quizFeedback, setQuizFeedback] = useState<QuizFeedback>(null);
  const [correctQuizCount, setCorrectQuizCount] = useState(0);
  const [answeredQuizIds, setAnsweredQuizIds] = useState<string[]>([]);
  const [isPreparing, startPreparingTransition] = useTransition();
  const [isChatting, startChatTransition] = useTransition();
  const playbackTimeoutRef = useRef<number | null>(null);
  const processedChunksRef = useRef<ProcessedChunk[]>([]);
  const prepareSessionRef = useRef(0);
  const trackedProgressRef = useRef("");
  const playChunkSegmentRef = useRef<
    ((index: number, type: PlaybackSegmentType) => Promise<void>) | null
  >(null);

  const { speak, stop } = useBrowserSpeech();

  useEffect(() => {
    processedChunksRef.current = processedChunks;
  }, [processedChunks]);

  const progressPercent = useMemo(() => {
    const total = totalChunkCount || processedChunks.length;

    if (!total) {
      return 0;
    }

    const stageFraction =
      currentStage === "narration"
        ? 0.2
        : currentStage === "summary"
          ? 0.55
          : currentStage === "checkpoint" || currentStage === "quiz" || currentStage === "feedback"
            ? 0.9
            : 0;

    return Math.min(
      100,
      ((completedChunks + stageFraction) / total) * 100
    );
  }, [completedChunks, currentStage, processedChunks.length, totalChunkCount]);

  const insightScore = useMemo(() => {
    return Math.min(99, completedChunks + correctQuizCount * 3);
  }, [completedChunks, correctQuizCount]);

  const unfinishedSessions = useMemo(
    () =>
      savedSessions
        .filter((session) => session.completedChunks < session.processedChunks.length)
        .slice(0, 3),
    [savedSessions]
  );

  const isAtArticleEnd = Boolean(
    (totalChunkCount || processedChunks.length) &&
      completedChunks >= (totalChunkCount || processedChunks.length)
  );

  const currentDisplayText = useMemo(() => {
    const chunk = processedChunks[currentChunk];

    if (currentStage === "complete") {
      return completionMessage;
    }

    if (currentStage === "checkpoint") {
      if (isAtArticleEnd) {
        return "You're at the end of the article. Finish now, or take a quick recap and quiz to lock it in.";
      }
      return "You reached a checkpoint. Keep listening, or take a quick recap and quiz to lock in the last two paragraphs.";
    }

    if (currentStage === "feedback" && quizFeedback) {
      return quizFeedback.text;
    }

    if (currentStage === "summary") {
      return checkpointRecapText || chunk?.summary || "";
    }

    if (!chunk) {
      return "";
    }

    if (currentStage === "quiz") {
      return chunk.question;
    }

    return chunk.narration;
  }, [
    checkpointRecapText,
    completionMessage,
    currentChunk,
    currentStage,
    isAtArticleEnd,
    processedChunks,
    quizFeedback,
  ]);

  const activeQuizChunk = useMemo(() => {
    const checkpointIndex = pendingCheckpoint?.endIndex ?? currentChunk;
    return processedChunks[checkpointIndex] ?? null;
  }, [currentChunk, pendingCheckpoint, processedChunks]);

  const canStart =
    processedChunks.length > 0 &&
    (playerState === "READY" ||
      playerState === "NARRATING" ||
      playerState === "SUMMARIZING" ||
      playerState === "QUIZZING" ||
      playerState === "FEEDBACK" ||
      playerState === "CHATTING");

  const canPause =
    playerState === "NARRATING" ||
    playerState === "SUMMARIZING" ||
    playerState === "QUIZZING" ||
    playerState === "FEEDBACK" ||
    playerState === "CHATTING";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedName = loadListenerName();
      setListenerName(storedName);
      setNameDraft(storedName);
      setSavedSessions(loadListeningHistory());
      setHasLoadedProfile(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!article || !processedChunks.length) {
      return;
    }

    const session: ListeningSession = {
      id: makeSessionId(article.url || article.title),
      article,
      processedChunks,
      currentChunk,
      completedChunks,
      finalSummary,
      chatMessages,
      insightScore,
      correctQuizCount,
      updatedAt: new Date().toISOString(),
    };

    saveListeningSession(session);

    const timer = window.setTimeout(() => {
      setSavedSessions(loadListeningHistory());
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    article,
    chatMessages,
    completedChunks,
    currentChunk,
    finalSummary,
    insightScore,
    processedChunks,
    correctQuizCount,
  ]);

  useEffect(() => {
    if (!article || !listenerName || !processedChunks.length || completedChunks <= 0) {
      return;
    }

    const event =
      completedChunks >= processedChunks.length
        ? "session_completed"
        : "session_progress";
    const trackingKey = `${article.url}:${completedChunks}:${insightScore}:${event}`;

    if (trackedProgressRef.current === trackingKey) {
      return;
    }

    trackedProgressRef.current = trackingKey;
    trackListenerEvent({
      name: listenerName,
      articleTitle: article.title,
      articleUrl: article.url,
      iqScore: insightScore,
      completedSections: completedChunks,
      event,
    });
  }, [article, completedChunks, insightScore, listenerName, processedChunks.length]);

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current !== null) {
        window.clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, []);

  const playChunkSegment = useCallback(
    async (index: number, type: PlaybackSegmentType) => {
      const chunk =
        processedChunksRef.current[index] ??
        (await waitForChunk(index, () => processedChunksRef.current));
      const totalChunks = totalChunkCount || processedChunksRef.current.length;

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
          text: `${chunk.question} ${(chunk.options ?? []).join(" ")}`,
          instructions:
            "Ask this like a reflective quiz host. End with a short pause for thought.",
          state: "QUIZZING",
          stage: "quiz",
        },
      };

      const payload = payloadMap[type];
      const spokenText = sanitizeForSpeech(payload.text);
      setCurrentChunk(index);
      setCheckpointRecapText("");
      setCurrentStage(payload.stage);
      setPlayerState(payload.state);

      try {
        await speak(spokenText, () => {
          if (type !== "narration") {
            setCurrentStage("quiz");
            setPlayerState("QUIZZING");
            return;
          }

          setCompletedChunks((previous) => Math.max(previous, index + 1));
          setCurrentStage(null);

          const isLastChunk = index >= totalChunks - 1;
          if (isLastChunk) {
            const startIndex = Math.max(0, index - 1);
            setPendingCheckpoint({ startIndex, endIndex: index });
            setCompletionMessage("Woohoo! You're done with the article.");
            setCurrentStage("complete");
            setPlayerState("READY");
            return;
          }

          const shouldCheckpoint =
            (index + 1) % 2 === 0;

          if (shouldCheckpoint) {
            setPendingCheckpoint({
              startIndex: Math.max(0, index - 1),
              endIndex: index,
            });
            setCurrentStage("checkpoint");
            setPlayerState("CHECKPOINT");
            return;
          }

          playbackTimeoutRef.current = window.setTimeout(() => {
            void playChunkSegmentRef.current?.(index + 1, "narration");
          }, 650);
        });
      } catch (playbackError) {
        const message =
          playbackError instanceof Error
            ? playbackError.message
            : "Audio playback failed.";
        console.error(playbackError);
        setError(
          `Free browser narration could not play. Detail: ${message.slice(0, 180)}`
        );
        setCheckpointRecapText("");
        setCurrentStage(null);
        setPlayerState("ERROR");
        return;
      }

    },
    [speak, totalChunkCount]
  );

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
    setArticle(null);
    setProcessedChunks([]);
    setTotalChunkCount(0);
    setCurrentChunk(0);
    setCompletedChunks(0);
    setCurrentStage(null);
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setCompletionMessage("");
    setQuizFeedback(null);
    setCorrectQuizCount(0);
    setAnsweredQuizIds([]);
    setFinalSummary("");
    setChatMessages([]);
    setPlayerState("PREPARING");
    trackedProgressRef.current = "";
    prepareSessionRef.current += 1;
    const prepareSessionId = prepareSessionRef.current;

    startPreparingTransition(async () => {
      try {
        const scraped = await postJson<Article>("/api/scrape", {
          url: url.trim(),
        });
        if (prepareSessionRef.current !== prepareSessionId) {
          return;
        }
        setArticle(scraped);

        const chunkResponse = await postJson<{ chunks: string[] }>("/api/chunk", {
          markdown: scraped.markdown,
          title: scraped.title,
        });
        if (prepareSessionRef.current !== prepareSessionId) {
          return;
        }

        const rawChunks = chunkResponse.chunks;
        setTotalChunkCount(rawChunks.length);

        const processChunk = async (chunk: string) => {
          try {
            return await postJson<ProcessedChunk>("/api/process-chunk", { chunk });
          } catch (processError) {
            console.warn("Chunk API failed, using client fallback.", processError);
            return createFallbackProcessedChunk(chunk);
          }
        };

        const initialCount = Math.max(1, Math.min(2, rawChunks.length));
        const initialProcessed = await mapWithConcurrency(
          rawChunks.slice(0, initialCount),
          2,
          processChunk
        );

        if (prepareSessionRef.current !== prepareSessionId) {
          return;
        }

        const allProcessed = [...initialProcessed];
        setProcessedChunks(initialProcessed);
        setChatMessages([
          {
            role: "assistant",
            content:
              "Your article is ready. Start the session, or ask me something about it right away.",
          },
        ]);
        setPlayerState("READY");
        trackListenerEvent({
          name: listenerName || nameDraft.trim(),
          articleTitle: scraped.title,
          articleUrl: scraped.url,
          iqScore: 0,
          completedSections: 0,
          event: "article_prepared",
        });

        if (rawChunks.length > initialCount) {
          const buffered = new Map<number, ProcessedChunk>();
          let nextAppendIndex = initialCount;

          const flushBuffered = () => {
            if (prepareSessionRef.current !== prepareSessionId) {
              return;
            }

            let changed = false;

            while (buffered.has(nextAppendIndex)) {
              const nextChunk = buffered.get(nextAppendIndex);
              buffered.delete(nextAppendIndex);

              if (nextChunk) {
                allProcessed.push(nextChunk);
                nextAppendIndex += 1;
                changed = true;
              }
            }

            if (changed) {
              setProcessedChunks([...allProcessed]);
            }
          };

          await mapWithConcurrency(
            rawChunks.slice(initialCount).map((chunk, offset) => ({
              chunk,
              index: initialCount + offset,
            })),
            2,
            async ({ chunk, index }) => {
              const processedChunk = await processChunk(chunk);
              buffered.set(index, processedChunk);
              flushBuffered();
              return processedChunk;
            }
          );
        }

        if (prepareSessionRef.current !== prepareSessionId) {
          return;
        }

        const summaries = allProcessed.map((item) => item.summary);
        try {
          const summaryResponse = await postJson<{ summary: string }>(
            "/api/final-summary",
            {
              title: scraped.title,
              summaries,
            }
          );
          if (prepareSessionRef.current === prepareSessionId) {
            setFinalSummary(summaryResponse.summary);
          }
        } catch (summaryError) {
          console.warn("Final summary API failed, using client fallback.", summaryError);
          if (prepareSessionRef.current === prepareSessionId) {
            setFinalSummary(createFallbackFinalSummary(scraped.title, summaries));
          }
        }
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

  function handleSaveProfile() {
    const trimmed = nameDraft.trim();

    if (!trimmed) {
      return;
    }

    saveListenerName(trimmed);
    setListenerName(trimmed);
    trackListenerEvent({
      name: trimmed,
      event: "profile_saved",
    });
  }

  function handleRestoreSession(session: ListeningSession) {
    prepareSessionRef.current += 1;
    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }

    setUrl(session.article.url);
    setArticle(session.article);
    setProcessedChunks(session.processedChunks);
    setTotalChunkCount(session.processedChunks.length);
    setCurrentChunk(session.currentChunk);
    setCompletedChunks(session.completedChunks);
    setCurrentStage(null);
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setCompletionMessage("");
    setQuizFeedback(null);
    setCorrectQuizCount(session.correctQuizCount ?? 0);
    setAnsweredQuizIds([]);
    setChatMessages(session.chatMessages);
    setFinalSummary(session.finalSummary);
    setError("");
    setPlayerState("READY");
    trackedProgressRef.current = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleStartPlayback() {
    if (!processedChunks.length) {
      return;
    }

    await playChunkSegment(currentChunk, "narration");
  }

  async function handleKeepListening() {
    if (!pendingCheckpoint) {
      if (isAtArticleEnd) {
        handleFinishArticle();
      }
      return;
    }

    const nextIndex = pendingCheckpoint.endIndex + 1;
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setQuizFeedback(null);

    if (nextIndex >= processedChunks.length || isAtArticleEnd) {
      handleFinishArticle();
      return;
    }

    await playChunkSegment(nextIndex, "narration");
  }

  function handleFinishArticle() {
    const endIndex = Math.max(0, processedChunks.length - 1);
    const startIndex = Math.max(0, endIndex - 1);
    if (processedChunks.length) {
      setPendingCheckpoint({ startIndex, endIndex });
    }
    setCheckpointRecapText("");
    setQuizFeedback(null);
    setCompletionMessage(
      "Woohoo! You're done with the article."
    );
    setCurrentStage("complete");
    setPlayerState("READY");
  }

  async function handleRecapAndQuiz() {
    if (!pendingCheckpoint) {
      return;
    }

    const checkpoint = pendingCheckpoint;
    const checkpointChunks = processedChunks.slice(
      checkpoint.startIndex,
      checkpoint.endIndex + 1
    );
    const quizChunk = processedChunks[checkpoint.endIndex];

    if (!quizChunk) {
      return;
    }

    const recapText = limitForSpeech(
      `Quick recap: ${checkpointChunks.map((chunk) => chunk.summary).join(" ")}`,
      560
    );
    const quizText = sanitizeForSpeech(
      `${quizChunk.question} ${(quizChunk.options ?? []).join(" ")}`
    );

    try {
      setCurrentChunk(checkpoint.endIndex);
      setCheckpointRecapText(recapText);
      setCurrentStage("summary");
      setPlayerState("SUMMARIZING");

      await speak(recapText);

      setCurrentStage("quiz");
      setPlayerState("QUIZZING");

      await speak(quizText);
    } catch (playbackError) {
      const message =
        playbackError instanceof Error
          ? playbackError.message
          : "Audio playback failed.";
      console.error(playbackError);
      setError(
        `Free browser recap could not play. Detail: ${message.slice(0, 180)}`
      );
      setPlayerState("ERROR");
      setCheckpointRecapText("");
      setCurrentStage(null);
    }
  }

  async function handleQuizAnswer(option: string) {
    if (!pendingCheckpoint || !activeQuizChunk) {
      return;
    }

    const answer = activeQuizChunk.answer ?? "A";
    const explanation =
      activeQuizChunk.explanation ??
      "This answer best captures the main point from the paragraph.";
    const correct = option === answer;
    const quizId = `${pendingCheckpoint.endIndex}_${answer}`;
    const feedbackText = limitForSpeech(
      correct ? `Correct. ${explanation}` : `Not quite. ${explanation}`,
      280
    );

    setQuizFeedback({ correct, text: feedbackText });
    setCurrentStage("feedback");
    setPlayerState("FEEDBACK");

    if (correct && !answeredQuizIds.includes(quizId)) {
      setAnsweredQuizIds((previous) => [...previous, quizId]);
      setCorrectQuizCount((previous) => previous + 1);
    }

    try {
      await speak(feedbackText);
    } catch (playbackError) {
      console.error(playbackError);
    }

    if (isAtArticleEnd) {
      handleFinishArticle();
    }
  }

  function handlePause() {
    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }
    setCurrentStage(null);
    setCheckpointRecapText("");
    if (processedChunks.length) {
      setPlayerState("READY");
    }
  }

  async function handlePreviousChunk() {
    if (!processedChunks.length) {
      return;
    }

    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }

    const previousIndex = Math.max(0, currentChunk - 1);
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setQuizFeedback(null);
    await playChunkSegment(previousIndex, "narration");
  }

  async function handleNextChunk() {
    if (!processedChunks.length) {
      return;
    }

    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }

    const nextIndex = Math.min(processedChunks.length - 1, currentChunk + 1);
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setQuizFeedback(null);
    await playChunkSegment(nextIndex, "narration");
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
      setPendingCheckpoint(null);
      setCheckpointRecapText("");
      setQuizFeedback(null);
    }

    const apiMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user" as const, content: message },
    ].slice(-10);

    const nextMessages: ChatMessage[] = [
      ...apiMessages,
      { role: "assistant" as const, content: "Thinking..." },
    ];
    setChatMessages(nextMessages);

    startChatTransition(async () => {
      try {
        const response = await postJson<{ reply: string }>("/api/chat", {
          messages: apiMessages,
          articleText: article.markdown,
          title: article.title,
          summaries: processedChunks.map((chunk) => chunk.summary),
        });

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: response.reply,
        };

        setChatMessages((previous) => {
          if (previous.length && previous[previous.length - 1]?.role === "assistant") {
            return [...previous.slice(0, -1), assistantMessage];
          }
          return [...previous, assistantMessage];
        });
        setPlayerState("CHATTING");

        await speak(sanitizeForSpeech(response.reply));

        if (processedChunks.length) {
          setPlayerState("READY");
        }
      } catch (requestError) {
        const message =
          requestError instanceof Error ? requestError.message : "Chat failed.";
        console.error(requestError);
        setError(formatError(message));
        setChatMessages((previous) => {
          const fallback: ChatMessage = {
            role: "assistant",
            content:
              "I couldn't answer right now. Please try again in a few seconds.",
          };
          if (previous.length && previous[previous.length - 1]?.role === "assistant") {
            return [...previous.slice(0, -1), fallback];
          }
          return [...previous, fallback];
        });
        setPlayerState("READY");
      }
    });
  }

  function handleReset() {
    prepareSessionRef.current += 1;
    stop();
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
    }
    setArticle(null);
    setProcessedChunks([]);
    setTotalChunkCount(0);
    setCurrentChunk(0);
    setCompletedChunks(0);
    setCurrentStage(null);
    setPendingCheckpoint(null);
    setCheckpointRecapText("");
    setCompletionMessage("");
    setQuizFeedback(null);
    setCorrectQuizCount(0);
    setAnsweredQuizIds([]);
    setChatMessages([]);
    setFinalSummary("");
    setError("");
    setPlayerState("IDLE");
    trackedProgressRef.current = "";
  }

  return (
    <main className="aurora-bg min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#140c2d_0%,#0d1328_46%,#070817_100%)] text-slate-100">
      {hasLoadedProfile && !listenerName ? (
        <section className="fixed inset-0 z-50 grid place-items-center bg-[#070817]/90 px-5 backdrop-blur-2xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveProfile();
            }}
            className="app-glass w-full max-w-md rounded-[2rem] p-6 text-white"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.36em] text-cyan-200">
              First things first
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-[-0.06em]">
              What should we call you?
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-slate-300">
              Your name appears in the player and makes the audio quest feel personal.
              We also save basic demo activity so the creator can understand usage.
            </p>
            <input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              autoFocus
              placeholder="Type your name"
              className="mt-6 min-h-14 w-full rounded-[1.2rem] border border-white/10 bg-white/10 px-4 text-lg font-bold text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
            />
            <button
              type="submit"
              disabled={!nameDraft.trim()}
              className="mt-4 min-h-14 w-full rounded-[1.25rem] bg-[linear-gradient(135deg,#a855f7,#22d3ee)] text-base font-black text-white shadow-[0_20px_70px_rgba(34,211,238,0.28)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enter ReadAloud
            </button>
          </form>
        </section>
      ) : null}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-3 py-4 sm:gap-7 sm:px-6 sm:py-5 lg:px-8">
        <header className="flex min-w-0 items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-3 backdrop-blur-2xl sm:px-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-cyan-300 text-base font-black text-slate-950 sm:h-10 sm:w-10 sm:text-lg">
              {(listenerName || "R").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black tracking-tight text-white">ReadAloud</p>
              <p className="truncate text-xs font-semibold text-slate-400">
                {listenerName ? `Welcome ${listenerName} ⭐` : "Audio learning OS"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/history"
              className="hidden rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-black text-white transition hover:bg-white/14 sm:inline-flex"
            >
              History
            </Link>
            <div className="rounded-full bg-white/8 px-3 py-2 text-sm font-black text-white sm:px-4">
              {insightScore} IQ
            </div>
          </div>
        </header>

        <section className="grid min-w-0 items-start gap-5 lg:gap-7 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="min-w-0 space-y-4 sm:space-y-5 xl:sticky xl:top-5">
            <div className="pt-1 sm:pt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-violet-300 sm:text-[11px] sm:tracking-[0.4em]">
                Now an experience
              </p>
              <h1 className="mt-3 max-w-2xl text-[3rem] font-black leading-[0.9] tracking-[-0.07em] text-white min-[390px]:text-5xl sm:mt-4 sm:text-7xl">
                Read articles like they are alive.
              </h1>
              <p className="mt-4 max-w-xl text-sm font-semibold leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
                Drop a link, press play, and get sharp narration, recaps, and
                mind-sharpening checkpoints hands free.
              </p>
            </div>

            <ArticleInput
              url={url}
              onUrlChange={setUrl}
              onSubmit={handlePrepareArticle}
              isLoading={isPreparing}
            />

            {error ? (
              <div className="rounded-[1.5rem] border border-rose-400/25 bg-rose-400/10 px-5 py-4 text-sm font-semibold leading-7 text-rose-100">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mx-auto w-full min-w-0 max-w-full sm:max-w-[38rem] xl:max-w-none">
            <PlayerBar
              playerState={playerState}
              canStart={canStart}
              canPause={canPause}
              onStart={handleStartPlayback}
              onPause={handlePause}
              onReset={handleReset}
              onPrevious={handlePreviousChunk}
              onNext={handleNextChunk}
              onKeepListening={handleKeepListening}
              onRecapQuiz={handleRecapAndQuiz}
              onSelectQuizAnswer={handleQuizAnswer}
              progressPercent={progressPercent}
              insightScore={insightScore}
              completedChunks={completedChunks}
      totalChunks={totalChunkCount || processedChunks.length}
              currentStage={currentStage}
              articleTitle={article?.title ?? ""}
              finalSummary={finalSummary}
              displayText={currentDisplayText}
              listenerName={listenerName}
              quizOptions={activeQuizChunk?.options ?? []}
              quizFeedback={quizFeedback?.text ?? ""}
            />
          </div>
        </section>

        <section className="grid min-w-0 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="app-glass rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-cyan-200">
                  Continue
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">
                  Continue where you left off
                </h2>
              </div>
              <Link
                href="/history"
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/16"
              >
                Open history
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {unfinishedSessions.length ? (
                unfinishedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => handleRestoreSession(session)}
                    className="group rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 text-left transition hover:border-cyan-200/40 hover:bg-white/[0.09]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-black leading-6 text-white">
                          {session.article.title}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-400">
                          Paragraph {Math.min(session.currentChunk + 1, session.processedChunks.length)} of{" "}
                          {session.processedChunks.length}
                        </p>
                      </div>
                      <span className="rounded-full bg-cyan-200 px-3 py-1 text-xs font-black text-slate-950">
                        Resume
                      </span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
                        style={{
                          width: `${Math.max(
                            7,
                            (session.completedChunks / session.processedChunks.length) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-white/12 bg-white/[0.04] p-5 text-sm font-semibold leading-7 text-slate-400">
                  Unfinished articles will appear here after you start a listening session.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {[
              ["Hands free", "Lean back and listen like a private briefing."],
              ["Recaps", "Every section ends with a crisp memory lock."],
              ["Earn IQ", "Progress and questions turn reading into a game."],
            ].map(([title, body]) => (
              <div key={title} className="app-glass rounded-[1.75rem] p-5">
                <p className="text-lg font-black text-white">{title}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">
                  {body}
                </p>
              </div>
            ))}
          </div>
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
