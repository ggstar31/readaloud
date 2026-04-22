"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadListeningHistory } from "@/lib/listening-history";
import type { ListeningSession } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<ListeningSession[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSessions(loadListeningHistory());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="aurora-bg min-h-screen bg-[linear-gradient(180deg,#140c2d_0%,#0d1328_46%,#070817_100%)] px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-2xl">
          <Link
            href="/"
            className="rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-black transition hover:bg-white/14"
          >
            Back
          </Link>
          <div className="text-right">
            <p className="text-sm font-black tracking-tight">History</p>
            <p className="text-xs font-semibold text-slate-400">Your article archive</p>
          </div>
        </header>

        <section className="pt-4">
          <p className="text-[11px] font-black uppercase tracking-[0.4em] text-violet-300">
            Reading trail
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.07em] sm:text-7xl">
            Every article you started.
          </h1>
          <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-300">
            This is saved in your browser for now. Later, when we add accounts, this
            can become a real cross-device reading history.
          </p>
        </section>

        <section className="grid gap-4">
          {sessions.length ? (
            sessions.map((session) => {
              const progress = Math.round(
                (session.completedChunks / session.processedChunks.length) * 100
              );

              return (
                <article
                  key={session.id}
                  className="app-glass rounded-[1.75rem] p-5 transition hover:border-cyan-200/35"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-2xl font-black leading-8 tracking-[-0.04em]">
                        {session.article.title}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-400">
                        Saved {formatDate(session.updatedAt)} · {progress}% complete ·{" "}
                        {session.insightScore} IQ
                      </p>
                    </div>
                    <a
                      href={session.article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-fit rounded-full bg-cyan-200 px-4 py-2 text-sm font-black text-slate-950 transition hover:brightness-110"
                    >
                      Open article
                    </a>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300"
                      style={{ width: `${Math.max(7, progress)}%` }}
                    />
                  </div>
                </article>
              );
            })
          ) : (
            <div className="app-glass rounded-[1.75rem] p-6 text-sm font-semibold leading-7 text-slate-300">
              No articles yet. Start one on the main screen and it will appear here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
