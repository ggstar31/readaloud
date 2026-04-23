"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeForSpeech } from "@/lib/speech-text";

function getPreferredVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
  const preferredNames = [
    "samantha",
    "victoria",
    "karen",
    "moira",
    "zira",
    "susan",
    "google uk english female",
    "google us english",
  ];

  return (
    englishVoices.find((voice) =>
      preferredNames.some((name) => voice.name.toLowerCase().includes(name))
    ) ??
    englishVoices[0] ??
    voices[0] ??
    null
  );
}

function splitForUtterances(text: string) {
  const clean = sanitizeForSpeech(text);
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const candidate = current ? `${current} ${trimmed}` : trimmed;

    if (candidate.length > 240 && current) {
      parts.push(current);
      current = trimmed;
      continue;
    }

    current = candidate;
  }

  if (current) {
    parts.push(current);
  }

  return parts.filter(Boolean);
}

export function useBrowserSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const activeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    const timer = window.setTimeout(loadVoices, 0);
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis.cancel();
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  function stop() {
    activeRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function speak(text: string, onEnded?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("This browser does not support free voice narration.");
    }

    stop();
    activeRef.current = true;

    const voice = getPreferredVoice(voices.length ? voices : window.speechSynthesis.getVoices());
    const parts = splitForUtterances(text);

    await new Promise<void>((resolve, reject) => {
      let index = 0;

      const speakNext = () => {
        if (!activeRef.current) {
          resolve();
          return;
        }

        const part = parts[index];

        if (!part) {
          activeRef.current = false;
          onEnded?.();
          resolve();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(part);
        utterance.voice = voice;
        utterance.lang = voice?.lang ?? "en-US";
        utterance.rate = 0.92;
        utterance.pitch = 1.04;
        utterance.volume = 1;
        utterance.onend = () => {
          index += 1;
          speakNext();
        };
        utterance.onerror = (event) => {
          if (event.error === "interrupted" || event.error === "canceled") {
            activeRef.current = false;
            resolve();
            return;
          }

          activeRef.current = false;
          reject(new Error(`Browser narration failed: ${event.error}`));
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    });
  }

  return {
    speak,
    stop,
    voiceName: getPreferredVoice(voices)?.name ?? "Device voice",
  };
}
