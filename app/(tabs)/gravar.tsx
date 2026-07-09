import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { FloatingShareButton } from "@/components/floating-share-button";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { OneVoxWordmark } from "@/components/brand/brand-bits";
import { useColors } from "@/hooks/use-colors";
import { useRecorder } from "@/hooks/use-recorder";
import { useSpeech } from "@/hooks/use-speech";
import { useOneVox } from "@/lib/onevox-store";
import { trpc } from "@/lib/trpc";
import { brandGradient } from "@/theme.config";

type Phase = "idle" | "recording" | "processing" | "result";

export default function GravarScreen() {
  const colors = useColors();
  const { fontSizeFor, addHistory } = useOneVox();
  const recorder = useRecorder();
  const { speak, state: speechState, lastAudioUrl } = useSpeech();

  const [phase, setPhase] = useState<Phase>("idle");
  const [original, setOriginal] = useState("");
  const [interpreted, setInterpreted] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const transcribeMutation = trpc.voice.uploadAndTranscribe.useMutation();

  const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const handleStart = async () => {
    setErrorMsg(null);
    haptic();
    const ok = await recorder.start();
    if (ok) setPhase("recording");
    else setErrorMsg("Não foi possível acessar o microfone. Verifique as permissões.");
  };

  const handleStop = async () => {
    haptic();
    setPhase("processing");
    const result = await recorder.stop();
    if (!result) {
      setErrorMsg("Não foi possível capturar o áudio. Tente novamente.");
      setPhase("idle");
      return;
    }
    try {
      const res = await transcribeMutation.mutateAsync({
        audioBase64: result.base64,
        mimeType: result.mimeType,
        language: "pt",
        interpret: true,
      });
      setOriginal(res.original);
      setInterpreted(res.interpreted ?? res.original);
      setPhase("result");
      if (res.interpreted) {
        addHistory({ text: res.interpreted, source: "gravar" });
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha ao processar o áudio.");
      setPhase("idle");
    }
  };

  const handleSpeak = (textToSpeak: string) => {
    if (!textToSpeak) return;
    haptic();
    speak(textToSpeak, { record: null }).catch(() => {});
  };

  const handleReset = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    setPhase("idle");
    setOriginal("");
    setInterpreted("");
    setErrorMsg(null);
  };

  const seconds = Math.floor(recorder.durationMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <ScreenContainer className="px-5">
      <View style={styles.header}>
        <OneVoxWordmark size={24} subtitle="GRAVE E DEIXE A IA INTERPRETAR" />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {errorMsg ? (
          <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.surface }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {(phase === "idle" || phase === "recording") && (
          <View style={styles.centerArea}>
            <Text style={[styles.instruction, { color: colors.muted, fontSize: fontSizeFor(16) }]}>
              {phase === "recording"
                ? "Estou ouvindo... fale com calma."
                : "Toque no microfone e fale. A IA vai transcrever, corrigir e gerar o áudio com sua voz."}
            </Text>

            {phase === "recording" && (
              <View style={styles.timerWrap}>
                <View style={[styles.recDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.timer, { color: colors.foreground }]}>
                  {mm}:{ss}
                </Text>
              </View>
            )}

            <Pressable
              onPress={phase === "recording" ? handleStop : handleStart}
              style={({ pressed }) => [styles.micOuter, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient
                colors={
                  phase === "recording"
                    ? [colors.error, "#C2410C"]
                    : (brandGradient as [string, string, ...string[]])
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.micBtn}
              >
                <IconSymbol
                  name={phase === "recording" ? "stop.fill" : "mic.fill"}
                  size={56}
                  color="#0A1628"
                />
              </LinearGradient>
            </Pressable>

            <Text style={[styles.micLabel, { color: colors.muted }]}>
              {phase === "recording" ? "Toque para parar" : "Toque para gravar"}
            </Text>
          </View>
        )}

        {phase === "processing" && (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.processingText, { color: colors.foreground }]}>
              Transcrevendo e interpretando...
            </Text>
            <Text style={[styles.instruction, { color: colors.muted }]}>
              Isso leva apenas alguns segundos.
            </Text>
          </View>
        )}

        {phase === "result" && (
          <View style={{ gap: 16 }}>
            {/* Original transcription */}
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <IconSymbol name="waveform" size={18} color={colors.muted} />
                <Text style={[styles.cardLabel, { color: colors.muted }]}>O QUE FOI CAPTADO</Text>
              </View>
              <Text style={[styles.cardText, { color: colors.muted, fontSize: fontSizeFor(16) }]}>
                {original || "(sem áudio detectado)"}
              </Text>
            </View>

            {/* Interpreted / rewritten */}
            <LinearGradient
              colors={brandGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resultBorder}
            >
              <View style={[styles.resultInner, { backgroundColor: colors.surfaceElevated }]}>
                <View style={styles.cardHeader}>
                  <IconSymbol name="sparkles" size={18} color={colors.primary} />
                  <Text style={[styles.cardLabel, { color: colors.primary }]}>MENSAGEM INTERPRETADA</Text>
                </View>
                <Text style={[styles.cardText, { color: colors.foreground, fontSize: fontSizeFor(20), fontWeight: "600" }]}>
                  {interpreted}
                </Text>
              </View>
            </LinearGradient>

            {/* Speak button */}
            <TouchableOpacity
              onPress={() => handleSpeak(interpreted)}
              disabled={speechState !== "idle"}
              activeOpacity={0.85}
              style={{ opacity: speechState !== "idle" ? 0.6 : 1 }}
            >
              <LinearGradient
                colors={brandGradient as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.playBtn}
              >
                {speechState === "generating" ? (
                  <ActivityIndicator color="#0A1628" />
                ) : (
                  <IconSymbol
                    name={speechState === "playing" ? "speaker.wave.2.fill" : "play.fill"}
                    size={24}
                    color="#0A1628"
                  />
                )}
                <Text style={styles.playText}>
                  {speechState === "generating"
                    ? "Gerando..."
                    : speechState === "playing"
                      ? "Falando..."
                      : "Falar com a voz clonada"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resultActions}>
              <TouchableOpacity
                onPress={() => handleSpeak(original)}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <IconSymbol name="waveform" size={18} color={colors.muted} />
                <Text style={[styles.secondaryText, { color: colors.foreground }]}>Falar original</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReset}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <IconSymbol name="mic.fill" size={18} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.foreground }]}>Gravar de novo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      {lastAudioUrl ? <FloatingShareButton audioUrl={lastAudioUrl} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 4, paddingBottom: 10 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 14 },
  centerArea: { alignItems: "center", justifyContent: "center", paddingTop: 32, gap: 20 },
  instruction: { textAlign: "center", lineHeight: 24, paddingHorizontal: 12 },
  timerWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  recDot: { width: 12, height: 12, borderRadius: 6 },
  timer: { fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  micOuter: {
    borderRadius: 120,
    shadowColor: "#34D8A0",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    marginTop: 12,
  },
  micBtn: {
    width: 160,
    height: 160,
    borderRadius: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  micLabel: { fontSize: 16, fontWeight: "600" },
  processingText: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  cardText: { lineHeight: 26 },
  resultBorder: { borderRadius: 18, padding: 2 },
  resultInner: { borderRadius: 16, padding: 16 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 60,
    borderRadius: 16,
  },
  playText: { color: "#0A1628", fontSize: 17, fontWeight: "700" },
  resultActions: { flexDirection: "row", gap: 12 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryText: { fontSize: 14, fontWeight: "600" },
});
