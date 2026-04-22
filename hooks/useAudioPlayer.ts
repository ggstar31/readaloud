"use client";

import { useEffect, useRef, useState } from "react";

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});

  async function ensureAudio(
    key: string,
    loader: () => Promise<Blob>
  ): Promise<string> {
    if (audioCache[key]) {
      return audioCache[key];
    }

    const blob = await loader();
    const blobUrl = URL.createObjectURL(blob);

    objectUrlsRef.current.add(blobUrl);
    setAudioCache((previous) => ({
      ...previous,
      [key]: blobUrl,
    }));

    return blobUrl;
  }

  async function playUrl(url: string, onEnded?: () => void) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;

    return new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        onEnded?.();
        resolve();
      };
      audio.onerror = () => reject(new Error("Audio playback failed."));

      void audio.play().catch(reject);
    });
  }

  function stop() {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  }

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;

    return () => {
      stop();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  return {
    audioCache,
    ensureAudio,
    playUrl,
    stop,
  };
}
