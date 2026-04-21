"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/types";

type ChatDrawerProps = {
  messages: ChatMessage[];
  isEnabled: boolean;
  isSending: boolean;
  onSend: (message: string) => void;
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
  articleTitle,
}: ChatDrawerProps) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
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
      setVoiceMessage("Voice note captured. You can edit it before sending.");
    };

    recognition.onerror = (event) => {
      setVoiceMessage(
        event.error === "not-allowed"
          ? "Microphone access was blocked by the browser."
          : "Voice note capture hit a browser issue."
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

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(16,28,45,0.96),rgba(7,9,19,0.98))] p-6 text-slate-50 shadow-[0_24px_120px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-fuchsia-200/70">
            Ask anytime
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Conversation mode</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-slate-300">
            Pause the session, ask a question, or record a short voice note for
            the article companion.
          </p>
        </div>
        <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
          {isEnabled ? "Ready now" : "Available once an article loads"}
        </span>
      </div>

      <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
        {messages.length ? (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-[1.1rem] px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto max-w-[88%] bg-fuchsia-100 text-slate-950"
                  : "max-w-[92%] bg-white/10 text-slate-100"
              }`}
            >
              {message.content}
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-300">
            Once {articleTitle || "your article"} is loaded, the listener can ask
            questions at any point instead of waiting for the session to finish.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!isEnabled || isSending}
          rows={3}
          placeholder="Ask for clarification, a simpler explanation, or extra context."
          className="w-full rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-65"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!isEnabled || isSending || !draft.trim()}
            className="rounded-full bg-[#f7b955] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#ffd07c] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isSending ? "Thinking..." : "Send question"}
          </button>
          {recognitionConstructor ? (
            <button
              type="button"
              onClick={isListening ? stopVoiceCapture : startVoiceCapture}
              disabled={!isEnabled || isSending}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isListening ? "Stop voice note" : "Voice note"}
            </button>
          ) : (
            <span className="text-sm text-slate-400">
              Voice notes depend on browser speech recognition support.
            </span>
          )}
        </div>
        {voiceMessage ? (
          <p className="text-sm text-fuchsia-100/80">{voiceMessage}</p>
        ) : null}
      </form>
    </section>
  );
}
