import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

export type RecorderResult = {
  base64: string;
  mimeType: string;
  /** URI local do arquivo/blob gravado, para reproducao antes do upload. */
  uri: string;
};

/**
 * Recording hook built on expo-audio. Handles permission, start/stop, and
 * returns the captured audio as base64 for upload to the transcription route.
 */
export function useRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const startedAtRef = useRef<number>(0);

  const start = useCallback(async () => {
    try {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        setPermissionDenied(true);
        return false;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      return true;
    } catch (e) {
      console.warn("[recorder] start failed", e);
      return false;
    }
  }, [recorder]);

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return null;

      // Read the file as base64.
      let base64: string;
      let mimeType = "audio/m4a";
      if (Platform.OS === "web") {
        const resp = await fetch(uri);
        const blob = await resp.blob();
        mimeType = blob.type || "audio/webm";
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        mimeType = uri.endsWith(".wav") ? "audio/wav" : "audio/m4a";
      }

      if (!base64) return null;
      return { base64, mimeType, uri };
    } catch (e) {
      console.warn("[recorder] stop failed", e);
      return null;
    }
  }, [recorder]);

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationMs: state.durationMillis ?? 0,
    metering: state.metering,
    permissionDenied,
  };
}
