import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { OneVoxWordmark } from "@/components/brand/brand-bits";
import { useColors } from "@/hooks/use-colors";
import { useSpeech } from "@/hooks/use-speech";
import { useOneVox } from "@/lib/onevox-store";
import { trpc } from "@/lib/trpc";
import { brandGradient } from "@/theme.config";

const ONEAI_LOGO = require("@/assets/images/oneai-logo.png");

export default function TecladoScreen() {
  const colors = useColors();
  const { settings, fontSizeFor } = useOneVox();
  const { speak, state, error } = useSpeech();
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
  const inputFontSize = fontSizeFor(22);

  return (
    <ScreenContainer className="px-5">
      {/* Header */}
      <View style={styles.header}>
        <OneVoxWordmark size={26} subtitle="COMUNICAÇÃO COM SUA VOZ" />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Text area with gradient border */}
        <LinearGradient
          colors={brandGradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.inputBorder}
        >
          <View style={[styles.inputInner, { backgroundColor: colors.surface }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Escreva sua mensagem aqui..."
              placeholderTextColor={colors.muted}
              multiline
              style={[
                styles.input,
                { color: colors.foreground, fontSize: inputFontSize, lineHeight: inputFontSize * 1.35 },
              ]}
              textAlignVertical="top"
            />
            {text.length > 0 && (
              <Text style={[styles.counter, { color: colors.muted }]}>{text.length} caracteres</Text>
            )}
          </View>
        </LinearGradient>

        {/* Rewrite with AI */}
        <TouchableOpacity
          onPress={handleRewrite}
          disabled={!text.trim() || busy}
          style={[
            styles.rewriteBtn,
            { borderColor: colors.border, backgroundColor: colors.surface },
            (!text.trim() || busy) && { opacity: 0.45 },
          ]}
          activeOpacity={0.7}
        >
          {interpreting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <IconSymbol name="wand.and.stars" size={20} color={colors.primary} />
          )}
          <Text style={[styles.rewriteText, { color: colors.foreground }]}>
            {interpreting ? "Reescrevendo..." : "Corrigir e reescrever com IA"}
          </Text>
        </TouchableOpacity>

        {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

        {/* One AI speak button */}
        <View style={styles.speakWrap}>
          <Pressable
            onPress={handleSpeak}
            disabled={!text.trim() || busy}
            style={({ pressed }) => [
              styles.speakOuter,
              (!text.trim() || busy) && { opacity: 0.5 },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <LinearGradient
              colors={brandGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.speakRing}
            >
              <View style={[styles.speakLogoInner, { backgroundColor: colors.background }]}>
                <Image source={ONEAI_LOGO} style={styles.speakLogo} resizeMode="cover" />
                {state === "generating" ? (
                  <View style={styles.speakLoadingOverlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </Pressable>
          <Text style={[styles.speakLabel, { color: colors.muted }]}>
            {state === "generating"
              ? "Gerando áudio..."
              : state === "playing"
                ? "Falando..."
                : "Toque para falar com a voz clonada"}
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <QuickButton
            label="Sim"
            icon="checkmark"
            color={colors.success}
            onPress={() => handleQuick("Sim.")}
            disabled={busy}
          />
          <QuickButton
            label="Não"
            icon="xmark"
            color={colors.error}
            onPress={() => handleQuick("Não.")}
            disabled={busy}
          />
        </View>
        <View style={styles.quickRow}>
          <QuickButton
            label="Limpar"
            icon="trash"
            color={colors.muted}
            onPress={handleClear}
            disabled={!text}
            outline
          />
          <QuickButton
            label="Desfazer"
            icon="arrow.uturn.backward"
            color={colors.muted}
            onPress={handleUndo}
            disabled={!!text || !lastCleared}
            outline
          />
        </View>
      </ScrollView>
    </ScreenContainer>
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
      <IconSymbol name={icon} size={22} color={color} />
      <Text style={[styles.quickLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },
  inputBorder: {
    borderRadius: 22,
    padding: 2,
    minHeight: 180,
  },
  inputInner: {
    borderRadius: 20,
    padding: 18,
    minHeight: 176,
  },
  input: {
    flex: 1,
    fontWeight: "600",
    minHeight: 130,
  },
  counter: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 6,
  },
  rewriteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  rewriteText: {
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 13,
  },
  speakWrap: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 8,
  },
  speakOuter: {
    borderRadius: 100,
    shadowColor: "#34D8A0",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  speakRing: {
    width: 142,
    height: 142,
    borderRadius: 100,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  speakLogoInner: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  speakLogo: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
  },
  speakLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 22, 40, 0.72)",
  },
  speakLabel: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "500",
  },
  quickRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 58,
    borderRadius: 14,
  },
  quickLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
});
