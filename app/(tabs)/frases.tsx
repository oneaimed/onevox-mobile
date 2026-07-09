import { useMemo, useState } from "react";
import {
  Modal,
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
import { useOneVox, type Phrase, type PhraseCategory } from "@/lib/onevox-store";
import { brandGradient } from "@/theme.config";

const CATEGORIES: { key: PhraseCategory; label: string; icon: any; color: string }[] = [
  { key: "necessidades", label: "Necessidades", icon: "hand.raised.fill", color: "#34D8A0" },
  { key: "saude", label: "Saúde", icon: "cross.case.fill", color: "#3AAEE6" },
  { key: "social", label: "Social", icon: "bubble.left.fill", color: "#A78BFA" },
  { key: "emergencia", label: "Emergência", icon: "exclamationmark.triangle.fill", color: "#F87171" },
];

export default function FrasesScreen() {
  const colors = useColors();
  const { phrases, addPhrase, removePhrase, fontSizeFor } = useOneVox();
  const { speak, state } = useSpeech();
  const [activeCat, setActiveCat] = useState<PhraseCategory>("necessidades");
  const [modalOpen, setModalOpen] = useState(false);
  const [newText, setNewText] = useState("");

  const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const filtered = useMemo(() => phrases.filter((p) => p.category === activeCat), [phrases, activeCat]);
  const activeColor = CATEGORIES.find((c) => c.key === activeCat)?.color ?? colors.primary;

  const handleSpeak = (phrase: Phrase) => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    speak(phrase.text, { record: "frases" }).catch(() => {});
  };

  const handleAdd = () => {
    if (!newText.trim()) return;
    haptic();
    addPhrase(newText, activeCat);
    setNewText("");
    setModalOpen(false);
  };

  return (
    <ScreenContainer className="px-5">
      <View style={styles.header}>
        <OneVoxWordmark size={26} subtitle="FRASES RÁPIDAS" />
      </View>

      {/* Categorias — 4 lado a lado, compactas */}
      <View style={styles.catRow}>
        {CATEGORIES.map((cat) => {
          const active = cat.key === activeCat;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => {
                haptic();
                setActiveCat(cat.key);
              }}
              activeOpacity={0.85}
              style={[
                styles.catTab,
                {
                  backgroundColor: active ? cat.color : colors.surface,
                  borderColor: active ? cat.color : colors.border,
                },
              ]}
            >
              <IconSymbol name={cat.icon} size={20} color={active ? "#0A1628" : cat.color} />
              <Text
                numberOfLines={1}
                style={[
                  styles.catLabel,
                  { color: active ? "#0A1628" : colors.muted, fontWeight: active ? "700" : "600" },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Lista de frases — linhas enxutas */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 2, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.map((phrase) => (
          <View
            key={phrase.id}
            style={[styles.phraseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable
              onPress={() => handleSpeak(phrase)}
              disabled={state !== "idle"}
              style={({ pressed }) => [styles.phraseTap, pressed && { opacity: 0.6 }]}
            >
              <IconSymbol name="speaker.wave.2.fill" size={20} color={activeColor} />
              <Text
                style={[styles.phraseText, { color: colors.foreground, fontSize: fontSizeFor(17) }]}
                numberOfLines={2}
              >
                {phrase.text}
              </Text>
            </Pressable>
            <TouchableOpacity
              onPress={() => {
                haptic(Haptics.ImpactFeedbackStyle.Medium);
                removePhrase(phrase.id);
              }}
              hitSlop={8}
              accessibilityLabel="Remover frase"
              style={styles.removeBtn}
            >
              <IconSymbol name="xmark" size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Adicionar frase — inline, tracejado */}
        <TouchableOpacity
          onPress={() => {
            haptic();
            setModalOpen(true);
          }}
          activeOpacity={0.8}
          style={[styles.addBtn, { borderColor: colors.border }]}
        >
          <IconSymbol name="plus" size={18} color={colors.muted} />
          <Text style={[styles.addText, { color: colors.muted }]}>Adicionar frase</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal nova frase */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Nova frase</Text>
            <Text style={[styles.modalSub, { color: colors.muted }]}>
              Categoria: {CATEGORIES.find((c) => c.key === activeCat)?.label}
            </Text>
            <TextInput
              value={newText}
              onChangeText={setNewText}
              placeholder="Digite a frase..."
              placeholderTextColor={colors.muted}
              multiline
              style={[
                styles.modalInput,
                { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setModalOpen(false);
                  setNewText("");
                }}
                style={[styles.modalBtn, { borderColor: colors.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAdd} activeOpacity={0.85} style={{ flex: 1 }} disabled={!newText.trim()}>
                <LinearGradient
                  colors={brandGradient as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.modalBtn, { opacity: newText.trim() ? 1 : 0.5 }]}
                >
                  <Text style={[styles.modalBtnText, { color: "#0A1628", fontWeight: "700" }]}>Salvar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 8, paddingBottom: 10 },
  catRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catTab: {
    flex: 1,
    minHeight: 60,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  catLabel: { fontSize: 11 },
  phraseRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  phraseTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 58,
  },
  phraseText: { flex: 1, fontWeight: "600", lineHeight: 23 },
  removeBtn: { paddingHorizontal: 14, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 2,
  },
  addText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  modalCard: { borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalSub: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    minHeight: 90,
    textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  modalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
});
