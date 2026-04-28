"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/types";

type ChatDrawerProps = {
  messages: ChatMessage[];
  isEnabled: boolean;
  isSending: boolean;
  onSend: (message: string) => void;
  canPauseSpeech: boolean;
  onPauseSpeech: () => void;
  articleTitle: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

export function ChatDrawer({
  messages,
  isEnabled,
  isSending,
  onSend,
  canPauseSpeech,
  onPauseSpeech,
  articleTitle,
}: ChatDrawerProps) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const recognitionConstructor = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() || !isEnabled) {
      return;
    }

    onSend(draft.trim());
    setDraft("");
    setVoiceMessage("");
  }

  function startVoiceCapture() {
    if (!recognitionConstructor || !isEnabled) {
      return;
    }

    recognitionRef.current?.stop();

    const recognition = new recognitionConstructor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let nextTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        nextTranscript += event.results[index][0].transcript;
      }

      setDraft(nextTranscript.trim());
      setVoiceMessage("Voice note captured. Edit it or send.");
    };

    recognition.onerror = (event) => {
      setVoiceMessage(
        event.error === "not-allowed"
          ? "Microphone access was blocked by the browser."
          : "Voice capture hit a browser issue."
      );
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setVoiceMessage("Listening...");
    setIsListening(true);
    recognition.start();
  }

  function stopVoiceCapture() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  const latestAssistant =
    [...messages].reverse().find((message) => message.role === "assistant")?.content ??
    `I'm your reading companion for ${
      articleTitle || "this article"
    }. Ask me anything, or tap the mic to speak.`;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        disabled={!isEnabled}
        className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-50 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#22d3ee,#8b5cf6)] px-4 py-3 text-base font-black text-white shadow-[0_22px_65px_rgba(34,211,238,0.38)] transition hover:scale-[1.03] disabled:pointer-events-none disabled:opacity-45 sm:right-5 sm:gap-3 sm:px-6 sm:py-4 sm:text-lg lg:bottom-10 lg:right-10 ${
          isOpen ? "hidden" : "inline-flex"
        }`}
        aria-expanded={isOpen}
      >
        <span className="text-lg sm:text-xl">◉</span>
        Ask
      </button>

      <section
        className={`fixed inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-3xl rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,18,38,0.98),rgba(8,10,20,0.99))] p-4 text-white shadow-[0_-26px_100px_rgba(0,0,0,0.55)] transition duration-300 sm:inset-x-6 sm:rounded-[2.2rem] sm:p-6 ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[115%] opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="mx-auto mb-5 block h-1.5 w-24 rounded-full bg-white/25"
          aria-label={isOpen ? "Collapse conversation" : "Open conversation"}
        />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-violet-300 sm:text-[11px] sm:tracking-[0.34em]">
              Conversation
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              Ask about this article
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canPauseSpeech ? (
              <button
                type="button"
                onClick={onPauseSpeech}
                className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/16"
              >
                Pause
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/12 text-xl text-white/80 transition hover:bg-white/18 sm:h-12 sm:w-12 sm:text-2xl"
              aria-label="Close conversation"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1 sm:mt-6">
          <div className="max-w-[92%] break-words rounded-[1.2rem] border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold leading-6 text-slate-100 sm:max-w-[86%] sm:rounded-[1.35rem] sm:px-5 sm:py-4 sm:text-base sm:leading-7">
            {latestAssistant}
          </div>
          {messages
            .filter((message) => message.role === "user")
            .slice(-3)
            .map((message, index) => (
              <div
                key={`${message.content}-${index}`}
                className="ml-auto max-w-[90%] break-words rounded-[1.2rem] bg-violet-100 px-4 py-3 text-sm font-semibold leading-6 text-slate-950 sm:max-w-[82%] sm:rounded-[1.35rem] sm:px-5 sm:py-4 sm:text-base sm:leading-7"
              >
                {message.content}
              </div>
            ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 sm:mt-6">
          <div className="flex min-w-0 items-center gap-2 rounded-[1.3rem] border border-white/10 bg-white/10 p-2 sm:gap-3 sm:rounded-full">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!isEnabled || isSending}
              placeholder="Can you explain that simply?"
              className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-white outline-none placeholder:text-slate-400 disabled:cursor-not-allowed sm:px-4 sm:text-base"
            />
            {recognitionConstructor ? (
              <button
                type="button"
                onClick={isListening ? stopVoiceCapture : startVoiceCapture}
                disabled={!isEnabled || isSending}
                className={`grid h-12 w-12 place-items-center rounded-full text-lg font-black transition ${
                  isListening
                    ? "bg-rose-400 text-slate-950"
                    : "bg-white/10 text-white hover:bg-white/16"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                aria-label="Voice note"
              >
                {isListening ? "■" : "◦"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!isEnabled || isSending || !draft.trim()}
              className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,#f0abfc,#facc15)] text-xl font-black text-slate-950 transition hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send question"
            >
              ↑
            </button>
          </div>
          {voiceMessage ? (
            <p className="mt-3 text-sm font-semibold text-violet-200">{voiceMessage}</p>
          ) : null}
        </form>
      </section>
    </>
  );
}
