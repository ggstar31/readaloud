"use client";

import { FormEvent, useState } from "react";
import type { ChatMessage } from "@/types";

type ChatDrawerProps = {
  messages: ChatMessage[];
  isEnabled: boolean;
  isSending: boolean;
  onSend: (message: string) => void;
  articleTitle: string;
};

export function ChatDrawer({
  messages,
  isEnabled,
  isSending,
  onSend,
  articleTitle,
}: ChatDrawerProps) {
  const [draft, setDraft] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim() || !isEnabled) {
      return;
    }

    onSend(draft.trim());
    setDraft("");
  }

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-[#102c39] p-6 text-slate-50 shadow-[0_24px_100px_rgba(23,58,78,0.18)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/70">
            Conversation mode
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Ask about what you just heard
          </h2>
        </div>
        <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">
          {isEnabled ? "Unlocked" : "Available after article playback"}
        </span>
      </div>

      <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
        {messages.length ? (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-[1.1rem] px-4 py-3 text-sm leading-6 ${
                message.role === "user"
                  ? "ml-auto max-w-[88%] bg-cyan-100 text-slate-950"
                  : "max-w-[92%] bg-white/10 text-slate-100"
              }`}
            >
              {message.content}
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-slate-300">
            After the article finishes, the listener can ask follow-up questions
            about {articleTitle || "the article"} and hear the response aloud.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!isEnabled || isSending}
          rows={3}
          placeholder="Ask for clarification, context, or the key takeaway."
          className="w-full rounded-[1.4rem] border border-white/10 bg-white/8 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-65"
        />
        <button
          type="submit"
          disabled={!isEnabled || isSending || !draft.trim()}
          className="rounded-full bg-[#f4b860] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#f2ae47] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {isSending ? "Thinking..." : "Send question"}
        </button>
      </form>
    </section>
  );
}
