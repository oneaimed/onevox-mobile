import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { OneVoxWordmark } from "@/components/brand/brand-bits";
import { useColors } from "@/hooks/use-colors";
import { useSpeech } from "@/hooks/use-speech";
import { useOneVox, type FontScale } from "@/lib/onevox-store";
import { useAuth } from "@/lib/auth-context";
import { trpc } from "@/lib/trpc";
import { brandGradient } from "@/theme.config";

const FONT_OPTIONS: { key: FontScale; label: string }[] = [
  { key: "normal", label: "A" },
  { key: "large", label: "A+" },
  { key: "xlarge", label: "A++" },
];

export default function PerfilScreen() {
  const colors = useColors();
  const { settings, updateSettings, history, clearHistory } = useOneVox();
  const { speak, state } = useSpeech();
  const { signOut } = useAuth();

  // Dados reais do paciente logado (nome/email/voz/role) e consumo.
  const router = useRouter();
  const me = trpc.auth.me.useQuery();
  const isAdmin = me.data?.role === "admin";

  const displayName = me.data?.name || me.data?.email?.split("@")[0] || "Paciente";
  const email = me.data?.email ?? "";
  const hasClonedVoice = !!me.data?.voiceId;

  const haptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const testVoice = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    speak("Olá, esta é a minha voz no OneVox.", { record: null }).catch(() => {});
  };

  const handleLogout = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    // O portao no _layout redireciona para /login quando a sessao cai.
    signOut().catch(() => {});
  };

  return (
    <ScreenContainer className="px-5">
      <View style={styles.header}>
        <OneVoxWordmark size={24} subtitle="PERFIL E AJUSTES" />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 20, gap: 18 }} showsVerticalScrollIndicator={false}>
        {/* Cloned voice card */}
        <LinearGradient
          colors={brandGradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.voiceBorder}
        >
          <View style={[styles.voiceInner, { backgroundColor: colors.surfaceElevated }]}>
            <View style={styles.voiceTop}>
              <View style={[styles.avatar, { borderColor: colors.primary }]}>
                <IconSymbol name="waveform" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.voiceName, { color: colors.foreground }]} numberOfLines={2}>
                    {displayName}
                  </Text>
                  {isAdmin ? (
                    <View style={[styles.adminBadge, { borderColor: colors.primary }]}>
                      <Text style={[styles.adminBadgeText, { color: colors.primary }]}>ADMIN</Text>
                    </View>
                  ) : null}
                </View>
                {email ? (
                  <Text style={[styles.voiceEmail, { color: colors.muted }]} numberOfLines={1}>
                    {email}
                  </Text>
                ) : null}
                <View style={styles.activePill}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: hasClonedVoice ? colors.success : colors.warning },
                    ]}
                  />
                  <Text
                    style={[
                      styles.activeText,
                      { color: hasClonedVoice ? colors.success : colors.warning },
                    ]}
                  >
                    {hasClonedVoice ? "Voz clonada ativa" : "Usando voz genérica"}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={testVoice}
              disabled={state !== "idle"}
              activeOpacity={0.85}
              style={{ marginTop: 16 }}
            >
              <LinearGradient
                colors={brandGradient as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.testBtn, { opacity: state !== "idle" ? 0.6 : 1 }]}
              >
                {state === "generating" ? (
                  <ActivityIndicator color="#0A1628" size="small" />
                ) : (
                  <IconSymbol name="play.fill" size={18} color="#0A1628" />
                )}
                <Text style={styles.testText}>Testar minha voz</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Accessibility: font size */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="textformat.size" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tamanho do texto</Text>
          </View>
          <View style={styles.fontRow}>
            {FONT_OPTIONS.map((opt) => {
              const active = settings.fontScale === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    haptic();
                    updateSettings({ fontScale: opt.key });
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.fontBtn,
                    {
                      backgroundColor: active ? colors.primary : "transparent",
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? "#0A1628" : colors.foreground,
                      fontWeight: "700",
                      fontSize: opt.key === "normal" ? 16 : opt.key === "large" ? 19 : 22,
                    }}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Auto interpret toggle */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="sparkles" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reescrita automática</Text>
              </View>
              <Text style={[styles.sectionDesc, { color: colors.muted }]}>
                Corrige e melhora o texto com IA antes de falar (na aba Teclado).
              </Text>
            </View>
            <Switch
              value={settings.autoInterpret}
              onValueChange={(val) => {
                haptic(Haptics.ImpactFeedbackStyle.Medium);
                updateSettings({ autoInterpret: val });
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* History */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.sectionHeader}>
              <IconSymbol name="clock.fill" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Histórico</Text>
            </View>
            {history.length > 0 && (
              <TouchableOpacity onPress={() => { haptic(); clearHistory(); }} activeOpacity={0.7}>
                <Text style={[styles.clearText, { color: colors.error }]}>Limpar</Text>
              </TouchableOpacity>
            )}
          </View>
          {history.length === 0 ? (
            <Text style={[styles.sectionDesc, { color: colors.muted, marginTop: 4 }]}>
              Suas mensagens faladas aparecerão aqui.
            </Text>
          ) : (
            <View style={{ marginTop: 6, gap: 8 }}>
              {history.slice(0, 8).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    haptic();
                    speak(item.text, { record: null }).catch(() => {});
                  }}
                  style={({ pressed }) => [
                    styles.historyItem,
                    { borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <IconSymbol name="speaker.wave.2.fill" size={16} color={colors.muted} />
                  <Text style={[styles.historyText, { color: colors.foreground }]} numberOfLines={1}>
                    {item.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Painel de uso — somente admin */}
        {isAdmin ? (
          <TouchableOpacity onPress={() => { haptic(); router.push("/uso"); }} activeOpacity={0.85}>
            <View style={[styles.section, styles.adminCta, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="waveform" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Painel de uso</Text>
              </View>
              <IconSymbol name="chevron.right" size={22} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Support */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <IconSymbol name="questionmark.circle" size={20} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Sobre o OneVox</Text>
          </View>
          <Text style={[styles.sectionDesc, { color: colors.muted, marginTop: 4 }]}>
            OneVox Mobile · versão 1.0.0{"\n"}Comunicação assistiva com voz clonada, powered by OneAI.
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={[styles.logoutBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.logoutText, { color: colors.error }]}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 4, paddingBottom: 8 },
  voiceBorder: { borderRadius: 22, padding: 2 },
  voiceInner: { borderRadius: 20, padding: 18 },
  voiceTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  voiceName: { flex: 1, fontSize: 17, fontWeight: "700", lineHeight: 21 },
  voiceEmail: { fontSize: 13, marginTop: 2 },
  adminCta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adminBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  adminBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontSize: 13, fontWeight: "600" },
  voiceActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  testText: { color: "#0A1628", fontSize: 15, fontWeight: "700" },
  switchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
  },
  switchText: { fontSize: 15, fontWeight: "600" },
  voiceList: { marginTop: 14, gap: 8 },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  voiceOptionText: { fontSize: 15, fontWeight: "600" },
  emptyText: { fontSize: 14, textAlign: "center", marginVertical: 10 },
  section: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionDesc: { fontSize: 13, lineHeight: 19 },
  fontRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  fontBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  clearText: { fontSize: 14, fontWeight: "600" },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  historyText: { flex: 1, fontSize: 14 },
  logoutBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutText: { fontSize: 15, fontWeight: "700" },
});
