import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { trpc } from "@/lib/trpc";
import { getApiBaseUrl } from "@/constants/oauth";
import { useOneVox } from "@/lib/onevox-store";

/**
 * Convert a storage url returned by the server (possibly relative,
 * e.g. "/manus-storage/...") into an absolute URL playable on device.
 */
function toAbsoluteUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  const base = getApiBaseUrl();
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export type SpeechState = "idle" | "generating" | "playing";

const PLAYBACK_AUDIO_MODE = {
  playsInSilentMode: true,
  allowsRecording: false,
  shouldRouteThroughEarpiece: false,
};

/**
 * Centralized speech hook: generates audio with the cloned voice via the
 * server (ElevenLabs) and plays it. Tracks state for UI feedback.
 */
export function useSpeech() {
  const { settings, addHistory } = useOneVox();
  const [state, setState] = useState<SpeechState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const generateMutation = trpc.voice.generateSpeech.useMutation();

  useEffect(() => {
    setAudioModeAsync(PLAYBACK_AUDIO_MODE).catch(() => {});
    return () => {
      try {
        playerRef.current?.remove();
      } catch {}
    };
  }, []);

  const stop = useCallback(() => {
    try {
      playerRef.current?.pause();
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
    setState("idle");
  }, []);

  const playUrl = useCallback((absoluteUrl: string) => {
    // Clean up any previous player.
    try {
      playerRef.current?.remove();
    } catch {}
    const player = createAudioPlayer({ uri: absoluteUrl });
    playerRef.current = player;

    const onUpdate = (status: { didJustFinish?: boolean }) => {
      if (status.didJustFinish) {
        setState("idle");
        try {
          player.remove();
        } catch {}
        if (playerRef.current === player) playerRef.current = null;
      }
    };
    player.addListener("playbackStatusUpdate", onUpdate as any);
    player.play();
    setState("playing");
  }, []);

  /**
   * Generate speech from text (cloned voice) and play it.
   * @param record source label for history; pass null to skip history.
   */
  const speak = useCallback(
    async (
      text: string,
      options?: { record?: "teclado" | "gravar" | "frases" | null; voiceId?: string },
    ) => {
      const clean = text?.trim();
      if (!clean) return;
      setError(null);
      setState("generating");
      try {
        const res = await generateMutation.mutateAsync({
          text: clean,
          voiceId: options?.voiceId ?? settings.voiceId,
        });
        const absoluteUrl = toAbsoluteUrl(res.url);
        setLastAudioUrl(absoluteUrl);
        if (options?.record !== null) {
          addHistory({ text: clean, source: options?.record ?? "teclado" });
        }
        await setAudioModeAsync(PLAYBACK_AUDIO_MODE);
        if (Platform.OS === "web") {
          // On web, use the HTML audio element for reliability.
          const audio = new (globalThis as any).Audio(absoluteUrl);
          audio.onended = () => setState("idle");
          audio.play().catch(() => setState("idle"));
          setState("playing");
        } else {
          playUrl(absoluteUrl);
        }
      } catch (e) {
        setState("idle");
        setError(e instanceof Error ? e.message : "Falha ao gerar áudio");
        throw e;
      }
    },
    [generateMutation, settings.voiceId, addHistory, playUrl],
  );

  return { speak, stop, state, error, lastAudioUrl, isBusy: state !== "idle" };
}
