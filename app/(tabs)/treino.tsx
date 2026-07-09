import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { OneVoxWordmark } from "@/components/brand/brand-bits";
import { useColors } from "@/hooks/use-colors";
import { useRecorder, type RecorderResult } from "@/hooks/use-recorder";
import { useOneVox } from "@/lib/onevox-store";
import { trpc } from "@/lib/trpc";
import { brandGradient } from "@/theme.config";

type RecPhase = "idle" | "recording" | "review" | "saving";
type Take = RecorderResult & { durationMs: number };

const PLAYBACK_MODE = { playsInSilentMode: true, allowsRecording: false };

export default function TreinoScreen() {
  const colors = useColors();
  const { fontSizeFor } = useOneVox();
  const recorder = useRecorder();
  const utils = trpc.useUtils();

  const stateQ = trpc.training.state.useQuery();
  const acceptMutation = trpc.training.acceptConsent.useMutation();
  const submitMutation = trpc.training.submitRecording.useMutation();

  const [localConsent, setLocalConsent] = useState(false);
  const [extraDone, setExtraDone] = useState<number[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [playing, setPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer | null>(null);
  const webAudioRef = useRef<{ pause: () => void } | null>(null);

  const phrases = stateQ.data?.phrases ?? [];
  const baseDone = stateQ.data?.doneIds ?? [];
  const consent = localConsent || (stateQ.data?.consentAccepted ?? false);

  const doneSet = useMemo(
    () => new Set<number>([...baseDone, ...extraDone]),
    [baseDone, extraDone],
  );
  const total = phrases.length;
  const doneCount = doneSet.size;
  const current = phrases[index];
  const allDone = total > 0 && doneCount >= total;

  const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const stopPlayback = useCallback(() => {
    try {
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
    try {
      webAudioRef.current?.pause();
    } catch {}
    webAudioRef.current = null;
    setPlaying(false);
  }, []);

  // Limpa player ao desmontar.
  useEffect(() => stopPlayback, [stopPlayback]);

  const playTake = useCallback(
    (uri: string) => {
      stopPlayback();
      if (Platform.OS === "web") {
        const audio = new (globalThis as any).Audio(uri);
        webAudioRef.current = audio;
        audio.onended = () => setPlaying(false);
        audio.play().catch(() => setPlaying(false));
        setPlaying(true);
      } else {
        setAudioModeAsync(PLAYBACK_MODE).catch(() => {});
        const player = createAudioPlayer({ uri });
        playerRef.current = player;
        player.addListener("playbackStatusUpdate", (s: { didJustFinish?: boolean }) => {
          if (s?.didJustFinish) {
            setPlaying(false);
            try {
              player.remove();
            } catch {}
            if (playerRef.current === player) playerRef.current = null;
          }
        });
        player.play();
        setPlaying(true);
      }
    },
    [stopPlayback],
  );

  // Primeiro indice ainda nao gravado (para "continuar de onde parou").
  const firstPending = useCallback(() => {
    for (let i = 0; i < phrases.length; i++) {
      if (!doneSet.has(phrases[i].id)) return i;
    }
    return 0;
  }, [phrases, doneSet]);

  const startSession = () => {
    haptic();
    setErrorMsg(null);
    setTake(null);
    setRecPhase("idle");
    setIndex(firstPending());
    setSessionActive(true);
  };

  const exitSession = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    stopPlayback();
    setTake(null);
    setRecPhase("idle");
    setSessionActive(false);
  };

  const handleStartRec = async () => {
    setErrorMsg(null);
    stopPlayback();
    setTake(null);
    haptic();
    const ok = await recorder.start();
    if (ok) setRecPhase("recording");
    else setErrorMsg("Nao foi possivel acessar o microfone. Verifique as permissoes.");
  };

  const handleStopRec = async () => {
    haptic();
    const durationMs = recorder.durationMs;
    const result = await recorder.stop();
    if (!result) {
      setErrorMsg("Nao foi possivel capturar o audio. Tente novamente.");
      setRecPhase("idle");
      return;
    }
    setTake({ ...result, durationMs });
    setRecPhase("review");
  };

  const advanceAfter = useCallback(
    (justDoneId: number) => {
      const done = new Set<number>([...baseDone, ...extraDone, justDoneId]);
      let next = -1;
      for (let i = index + 1; i < phrases.length; i++) {
        if (!done.has(phrases[i].id)) {
          next = i;
          break;
        }
      }
      if (next === -1) {
        for (let i = 0; i < index; i++) {
          if (!done.has(phrases[i].id)) {
            next = i;
            break;
          }
        }
      }
      if (next === -1) {
        setSessionActive(false); // acabou tudo -> volta pro resumo (estado concluido)
      } else {
        setIndex(next);
      }
    },
    [baseDone, extraDone, index, phrases],
  );

  const handleConfirm = async () => {
    if (!take || !current) return;
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    stopPlayback();
    setRecPhase("saving");
    try {
      await submitMutation.mutateAsync({
        fraseId: current.id,
        audioBase64: take.base64,
        mimeType: take.mimeType,
        durationMs: take.durationMs,
        plataforma: Platform.OS,
      });
      setExtraDone((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
      void utils.training.state.invalidate();
      setTake(null);
      setRecPhase("idle");
      advanceAfter(current.id);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha ao salvar a gravacao.");
      setRecPhase("review");
    }
  };

  const handleSkip = () => {
    haptic(Haptics.ImpactFeedbackStyle.Light);
    stopPlayback();
    setTake(null);
    setRecPhase("idle");
    if (total > 0) setIndex((i) => (i + 1) % total);
  };

  const handleAcceptConsent = async () => {
    haptic();
    try {
      await acceptMutation.mutateAsync();
      setLocalConsent(true);
      void utils.training.state.invalidate();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Falha ao registrar consentimento.");
    }
  };

  const seconds = Math.floor(recorder.durationMs / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  // ---------- LOADING / ERRO ----------
  if (stateQ.isLoading) {
    return (
      <ScreenContainer className="px-5">
        <View style={styles.header}>
          <OneVoxWordmark size={26} subtitle="TREINO DE VOZ" />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (stateQ.error) {
    return (
      <ScreenContainer className="px-5">
        <View style={styles.header}>
          <OneVoxWordmark size={26} subtitle="TREINO DE VOZ" />
        </View>
        <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.surface }]}>
          <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>{stateQ.error.message}</Text>
        </View>
      </ScreenContainer>
    );
  }

  // ---------- CONSENTIMENTO ----------
  if (!consent) {
    return (
      <ScreenContainer className="px-5">
        <View style={styles.header}>
          <OneVoxWordmark size={26} subtitle="TREINO DE VOZ" />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <IconSymbol name="graduationcap.fill" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>Participe da pesquisa</Text>
            </View>
            <Text style={[styles.consentText, { color: colors.foreground }]}>
              No treino de voz voce le frases em voz alta e grava a sua fala.
            </Text>
            <Text style={[styles.consentText, { color: colors.muted }]}>
              Essas gravacoes sao usadas na nossa pesquisa para melhorar os modelos que entendem e
              transcrevem a sua voz. Cada audio fica vinculado a frase que voce leu e a sua conta.
            </Text>
            <Text style={[styles.consentText, { color: colors.muted }]}>
              A sua voz e um dado pessoal e fica guardada de forma segura. A participacao e
              voluntaria e voce pode parar quando quiser.
            </Text>
          </View>

          {errorMsg ? (
            <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.surface }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.foreground }]}>{errorMsg}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={handleAcceptConsent}
            disabled={acceptMutation.isPending}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={brandGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.primaryBtn, { opacity: acceptMutation.isPending ? 0.6 : 1 }]}
            >
              {acceptMutation.isPending ? (
                <ActivityIndicator color="#0A1628" />
              ) : (
                <>
                  <IconSymbol name="checkmark" size={20} color="#0A1628" />
                  <Text style={styles.primaryText}>Aceito participar</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---------- RESUMO / PROGRESSO ----------
  if (!sessionActive) {
    return (
      <ScreenContainer className="px-5">
        <View style={styles.header}>
          <OneVoxWordmark size={26} subtitle="TREINO DE VOZ" />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 18 }} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={brandGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressBorder}
          >
            <View style={[styles.progressInner, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.progressCount, { color: colors.foreground }]}>
                {doneCount}
                <Text style={{ color: colors.muted, fontSize: 22 }}> / {total}</Text>
              </Text>
              <Text style={[styles.progressLabel, { color: colors.muted }]}>frases gravadas</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.background }]}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
              </View>
            </View>
          </LinearGradient>

          {total === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.consentText, { color: colors.muted }]}>
                O catalogo de frases ainda nao esta disponivel. Tente novamente mais tarde.
              </Text>
            </View>
          ) : allDone ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <IconSymbol name="checkmark.circle.fill" size={22} color={colors.success} />
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>Tudo pronto!</Text>
              </View>
              <Text style={[styles.consentText, { color: colors.muted }]}>
                Voce gravou todas as {total} frases. Muito obrigado por contribuir com a pesquisa.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.hint, { color: colors.muted }]}>
                Leia cada frase em voz alta, grave, ouca para conferir e confirme. Rapido e no seu ritmo.
              </Text>
              <TouchableOpacity onPress={startSession} activeOpacity={0.85}>
                <LinearGradient
                  colors={brandGradient as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <IconSymbol name="mic.fill" size={20} color="#0A1628" />
                  <Text style={styles.primaryText}>
                    {doneCount > 0 ? "Continuar treino" : "Comecar treino"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ---------- SESSAO (uma frase por vez) ----------
  return (
    <ScreenContainer className="px-5">
      <View style={styles.sessionTop}>
        <TouchableOpacity onPress={exitSession} activeOpacity={0.7} style={styles.iconBtn}>
          <IconSymbol name="xmark" size={22} color={colors.muted} />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
        <Text style={[styles.counter, { color: colors.muted }]}>
          {doneCount}/{total}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {errorMsg ? (
          <View style={[styles.errorBox, { borderColor: colors.error, backgroundColor: colors.surface }]}>
            <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.foreground }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Frase alvo */}
        <View style={[styles.phraseBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {current ? (
            <>
              {doneSet.has(current.id) ? (
                <View style={styles.doneTag}>
                  <IconSymbol name="checkmark.circle.fill" size={15} color={colors.success} />
                  <Text style={[styles.doneTagText, { color: colors.success }]}>Ja gravada</Text>
                </View>
              ) : null}
              <Text style={[styles.readLabel, { color: colors.muted }]}>LEIA EM VOZ ALTA</Text>
              <Text style={[styles.phraseText, { color: colors.foreground, fontSize: fontSizeFor(28) }]}>
                {current.texto}
              </Text>
            </>
          ) : (
            <Text style={[styles.consentText, { color: colors.muted }]}>Sem frase.</Text>
          )}
        </View>

        {/* Controles conforme a fase */}
        {(recPhase === "idle" || recPhase === "recording") && (
          <View style={styles.centerArea}>
            {recPhase === "recording" && (
              <View style={styles.timerWrap}>
                <View style={[styles.recDot, { backgroundColor: colors.error }]} />
                <Text style={[styles.timer, { color: colors.foreground }]}>
                  {mm}:{ss}
                </Text>
              </View>
            )}
            <Pressable
              onPress={recPhase === "recording" ? handleStopRec : handleStartRec}
              style={({ pressed }) => [styles.micOuter, pressed && { transform: [{ scale: 0.97 }] }]}
            >
              <LinearGradient
                colors={
                  recPhase === "recording"
                    ? [colors.error, "#C2410C"]
                    : (brandGradient as [string, string, ...string[]])
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.micBtn}
              >
                <IconSymbol
                  name={recPhase === "recording" ? "stop.fill" : "mic.fill"}
                  size={48}
                  color="#0A1628"
                />
              </LinearGradient>
            </Pressable>
            <Text style={[styles.micLabel, { color: colors.muted }]}>
              {recPhase === "recording" ? "Toque para parar" : "Toque para gravar"}
            </Text>
            {recPhase === "idle" && total > 1 ? (
              <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipBtn}>
                <Text style={[styles.skipText, { color: colors.muted }]}>Pular esta frase</Text>
                <IconSymbol name="arrow.right" size={16} color={colors.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {recPhase === "review" && take && (
          <View style={{ gap: 14, marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => (playing ? stopPlayback() : playTake(take.uri))}
              activeOpacity={0.85}
              style={[styles.reviewBtn, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            >
              <IconSymbol name={playing ? "stop.fill" : "play.fill"} size={22} color={colors.primary} />
              <Text style={[styles.reviewBtnText, { color: colors.foreground }]}>
                {playing ? "Parar" : "Ouvir a gravacao"}
              </Text>
            </TouchableOpacity>

            <View style={styles.reviewActions}>
              <TouchableOpacity
                onPress={handleStartRec}
                activeOpacity={0.7}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <IconSymbol name="arrow.uturn.backward" size={18} color={colors.foreground} />
                <Text style={[styles.secondaryText, { color: colors.foreground }]}>Regravar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85} style={{ flex: 1.4 }}>
                <LinearGradient
                  colors={brandGradient as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmBtn}
                >
                  <IconSymbol name="checkmark" size={20} color="#0A1628" />
                  <Text style={styles.primaryText}>Confirmar e proxima</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {recPhase === "saving" && (
          <View style={styles.centerArea}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.savingText, { color: colors.foreground }]}>Salvando gravacao...</Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 8, paddingBottom: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
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
  card: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  consentText: { fontSize: 15, lineHeight: 22 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 16,
  },
  primaryText: { color: "#0A1628", fontSize: 17, fontWeight: "700" },
  // resumo
  progressBorder: { borderRadius: 20, padding: 2 },
  progressInner: { borderRadius: 18, padding: 22, alignItems: "center" },
  progressCount: { fontSize: 44, fontWeight: "800" },
  progressLabel: { fontSize: 14, marginTop: 2, marginBottom: 16 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", width: "100%" },
  progressFill: { height: 8, borderRadius: 4 },
  hint: { fontSize: 14, lineHeight: 20, textAlign: "center", paddingHorizontal: 8 },
  // sessao
  sessionTop: { flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 14 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  counter: { fontSize: 14, fontWeight: "700", minWidth: 48, textAlign: "right" },
  phraseBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    minHeight: 150,
    justifyContent: "center",
    marginBottom: 8,
  },
  readLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 10 },
  phraseText: { fontWeight: "700", lineHeight: 38 },
  doneTag: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginBottom: 8 },
  doneTagText: { fontSize: 12, fontWeight: "700" },
  centerArea: { alignItems: "center", justifyContent: "center", paddingTop: 24, gap: 16 },
  timerWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  recDot: { width: 12, height: 12, borderRadius: 6 },
  timer: { fontSize: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
  micOuter: {
    borderRadius: 100,
    shadowColor: "#34D8A0",
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  micBtn: { width: 132, height: 132, borderRadius: 100, alignItems: "center", justifyContent: "center" },
  micLabel: { fontSize: 15, fontWeight: "600" },
  skipBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, padding: 8 },
  skipText: { fontSize: 14, fontWeight: "600" },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  reviewBtnText: { fontSize: 16, fontWeight: "700" },
  reviewActions: { flexDirection: "row", gap: 12 },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: "600" },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 16,
  },
  savingText: { fontSize: 16, fontWeight: "600", marginTop: 6 },
});
