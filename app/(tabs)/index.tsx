import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { OneVoxWordmark, PoweredByOneAI } from "@/components/brand/brand-bits";
import { useColors } from "@/hooks/use-colors";
import { useSpeech } from "@/hooks/use-speech";
import { useOneVox } from "@/lib/onevox-store";
import { trpc } from "@/lib/trpc";
import { brandGradient, BODY_FONT } from "@/theme.config";

const FONT = BODY_FONT;

export default function TecladoScreen() {
  const colors = useColors();
  const { settings, fontSizeFor } = useOneVox();
  const { speak, state, error, lastAudioUrl } = useSpeech();
  const [text, setText] = useState("");
  const [lastCleared, setLastCleared] = useState("");
  const [interpreting, setInterpreting] = useState(false);

  const interpretMutation = trpc.voice.interpret.useMutation();

  const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const handleSpeak = async () => {
    if (!text.trim() || state !== "idle") return;
    Keyboard.dismiss();
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let toSpeak = text.trim();
      if (settings.autoInterpret) {
        setInterpreting(true);
        try {
          const res = await interpretMutation.mutateAsync({ text: toSpeak });
          if (res.text) {
            toSpeak = res.text;
            setText(res.text);
          }
        } finally {
          setInterpreting(false);
        }
      }
      await speak(toSpeak, { record: "teclado" });
    } catch {
      // error surfaced via `error`
    }
  };

  const handleRewrite = async () => {
    if (!text.trim() || interpreting) return;
    haptic();
    setInterpreting(true);
    try {
      const res = await interpretMutation.mutateAsync({ text: text.trim() });
      if (res.text) setText(res.text);
    } catch {
    } finally {
      setInterpreting(false);
    }
  };

  const handleQuick = (phrase: string) => {
    haptic();
    speak(phrase, { record: "teclado" }).catch(() => {});
  };

  const handleClear = () => {
    haptic();
    setLastCleared(text);
    setText("");
  };

  const handleUndo = () => {
    haptic();
    if (!text && lastCleared) {
      setText(lastCleared);
      setLastCleared("");
    }
  };

  const busy = state !== "idle" || interpreting;
  const inputFontSize = fontSizeFor(18);
  const speakLabel = state === "generating" ? "Gerando..." : state === "playing" ? "Falando..." : "Falar";

  return (
    <ScreenContainer className="px-5">
      <View style={styles.header}>
        <OneVoxWordmark size={24} />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Area de texto */}
        <View
          style={[
            styles.inputCard,
            { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.border },
          ]}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreva sua mensagem aqui..."
            placeholderTextColor={colors.muted}
            multiline
            style={[
              styles.input,
              { color: colors.foreground, fontSize: inputFontSize, lineHeight: inputFontSize * 1.4 },
            ]}
            textAlignVertical="top"
          />
          {text.length > 0 && (
            <Text style={[styles.counter, { color: colors.muted }]}>{text.length} caracteres</Text>
          )}
        </View>

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        {/* Sim / Nao — falam direto */}
        <View style={styles.row}>
          <QuickButton label="Sim" icon="checkmark" color={colors.success} onPress={() => handleQuick("Sim.")} disabled={busy} />
          <QuickButton label="Não" icon="xmark" color={colors.error} onPress={() => handleQuick("Não.")} disabled={busy} />
        </View>

        {/* Limpar / Desfazer */}
        <View style={styles.row}>
          <QuickButton label="Limpar" icon="trash" color={colors.muted} onPress={handleClear} disabled={!text} outline />
          <QuickButton
            label="Desfazer"
            icon="arrow.uturn.backward"
            color={colors.muted}
            onPress={handleUndo}
            disabled={!!text || !lastCleared}
            outline
          />
        </View>

        {/* Falar — botao principal */}
        <TouchableOpacity
          onPress={handleSpeak}
          disabled={!text.trim() || busy}
          activeOpacity={0.85}
          style={{ marginTop: 4 }}
        >
          <LinearGradient
            colors={brandGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.speakBtn, (!text.trim() || busy) && { opacity: 0.5 }]}
          >
            {state === "generating" ? (
              <ActivityIndicator color="#0A1628" size="small" />
            ) : (
              <IconSymbol name="speaker.wave.2.fill" size={24} color="#0A1628" />
            )}
            <Text style={styles.speakBtnText}>{speakLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Corrigir e reescrever com IA */}
        <TouchableOpacity
          onPress={handleRewrite}
          disabled={!text.trim() || busy}
          activeOpacity={0.7}
          style={[styles.rewriteBtn, { borderColor: colors.primary }, (!text.trim() || busy) && { opacity: 0.45 }]}
        >
          {interpreting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="wand.and.stars" size={18} color={colors.primary} />
          )}
          <Text style={[styles.rewriteText, { color: colors.primary }]}>
            {interpreting ? "Reescrevendo..." : "Corrigir e reescrever"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <PoweredByOneAI />
      {lastAudioUrl ? <FloatingShareButton audioUrl={lastAudioUrl} /> : null}
    </ScreenContainer>
  );
}

function FloatingShareButton({ audioUrl }: { audioUrl: string }) {
  const colors = useColors();
  const startX = Math.max(Dimensions.get("window").width - 112, 240);
  const pan = useRef(new Animated.ValueXY({ x: startX, y: 440 })).current;
  const draggedRef = useRef(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!audioUrl) return;
    setSharing(true);
    try {
      if (Platform.OS === "web") {
        const navigatorWithShare = window.navigator as Navigator & {
          canShare?: (data: ShareData) => boolean;
        };
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        const file = new File([blob], "onevox-audio.mp3", { type: blob.type || "audio/mpeg" });
        const shareData: ShareData = {
          title: "Audio OneVox",
          files: [file],
        };

        if (navigatorWithShare.canShare?.(shareData)) {
          await navigatorWithShare.share(shareData);
          return;
        }

        if (navigatorWithShare.share) {
          await navigatorWithShare.share({
            title: "Audio OneVox",
            url: audioUrl,
          });
          return;
        }

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "onevox-audio.mp3";
        document.body.appendChild(link);
        link.click();
        URL.revokeObjectURL(link.href);
        link.remove();
        return;
      }

      const canShareFile = await Sharing.isAvailableAsync();
      if (canShareFile) {
        const fileUri = `${FileSystem.cacheDirectory}onevox-audio-${Date.now()}.mp3`;
        const result = await FileSystem.downloadAsync(audioUrl, fileUri);
        await Sharing.shareAsync(result.uri, {
          dialogTitle: "Compartilhar áudio OneVox",
          mimeType: "audio/mpeg",
          UTI: "public.mp3",
        });
        return;
      }

      await Share.share({
        title: "Áudio OneVox",
        url: audioUrl,
      });
    } finally {
      setSharing(false);
    }
  }, [audioUrl]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          draggedRef.current = false;
          pan.setOffset({
            x: (pan.x as any)._value,
            y: (pan.y as any)._value,
          });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: (_, gesture) => {
          if (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3) draggedRef.current = true;
          pan.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: () => {
          pan.flattenOffset();
          if (!draggedRef.current && !sharing) {
            handleShare().catch(() => {});
          }
        },
        onPanResponderTerminate: () => {
          pan.flattenOffset();
        },
      }),
    [handleShare, pan, sharing],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.shareFloatingWrap, { transform: pan.getTranslateTransform() }]}
    >
      <LinearGradient
        colors={brandGradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.shareFloatingBorder}
      >
        <View style={[styles.shareFloatingInner, { backgroundColor: colors.background }]}>
          {sharing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="square.and.arrow.up" size={22} color={colors.primary} />
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function QuickButton({
  label,
  icon,
  color,
  onPress,
  disabled,
  outline,
}: {
  label: string;
  icon: any;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  outline?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.quickBtn,
        {
          backgroundColor: outline ? "transparent" : colors.surface,
          borderColor: outline ? colors.border : color,
          borderWidth: outline ? 1 : 1.5,
        },
        disabled && { opacity: 0.4 },
      ]}
    >
      <IconSymbol name={icon} size={20} color={color} />
      <Text style={[styles.quickLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 8,
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    minHeight: 150,
  },
  input: {
    flex: 1,
    fontFamily: FONT,
    fontWeight: "500",
    minHeight: 120,
  },
  counter: {
    fontFamily: FONT,
    fontSize: 12,
    textAlign: "right",
    marginTop: 6,
  },
  error: {
    fontFamily: FONT,
    textAlign: "center",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  quickLabel: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: "700",
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 62,
    borderRadius: 16,
  },
  speakBtnText: {
    fontFamily: FONT,
    color: "#0A1628",
    fontSize: 18,
    fontWeight: "700",
  },
  rewriteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  rewriteText: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: "600",
  },
  shareFloatingWrap: {
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 20,
    elevation: 20,
  },
  shareFloatingBorder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 1.5,
    shadowColor: "#34D8A0",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  shareFloatingInner: {
    flex: 1,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
});
