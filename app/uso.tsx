import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { brandGradient, BODY_FONT } from "@/theme.config";

const OP_LABEL: Record<string, string> = {
  tts: "Fala (TTS)",
  stt: "Transcrição (STT)",
  correcao: "Correção",
};

function fmtUsd(n: number): string {
  if (!n) return "US$ 0,00";
  const v = n < 0.01 ? n.toFixed(4) : n.toFixed(2);
  return `US$ ${v.replace(".", ",")}`;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function UsoScreen() {
  const colors = useColors();
  const router = useRouter();
  const q = trpc.usage.adminDashboard.useQuery();
  const d = q.data;

  const maxDayCalls = Math.max(1, ...(d?.byDay ?? []).map((x) => x.calls));
  const maxOpCost = Math.max(1e-9, ...(d?.byOperation ?? []).map((x) => x.costUsd));
  const maxUserCost = Math.max(1e-9, ...(d?.byUser ?? []).map((x) => x.costUsd));

  return (
    <ScreenContainer className="px-5">
      {/* Barra superior */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Painel de uso</Text>
        <TouchableOpacity onPress={() => q.refetch()} hitSlop={10} style={styles.iconBtn}>
          <IconSymbol name="arrow.clockwise" size={20} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {q.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : q.error ? (
        <View style={styles.center}>
          <Text style={{ color: colors.error, textAlign: "center" }}>
            {q.error.message.includes("FORBIDDEN") || q.error.message.includes("UNAUTHORIZED")
              ? "Acesso restrito a administradores."
              : q.error.message}
          </Text>
        </View>
      ) : !d ? null : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Hero: custo total */}
          <LinearGradient
            colors={brandGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroBorder}
          >
            <View style={[styles.heroInner, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.heroLabel, { color: colors.muted }]}>CUSTO TOTAL ESTIMADO</Text>
              <Text style={[styles.heroValue, { color: colors.foreground }]}>{fmtUsd(d.totals.costUsd)}</Text>
              <Text style={[styles.heroSub, { color: colors.muted }]}>
                {d.totals.calls} falas · {d.totals.audioMinutes} min de áudio
              </Text>
            </View>
          </LinearGradient>

          {/* Stat grid */}
          <View style={styles.grid}>
            <Metric colors={colors} label="Falas" value={String(d.totals.calls)} />
            <Metric colors={colors} label="Áudio (min)" value={String(d.totals.audioMinutes)} />
            <Metric colors={colors} label="Tokens" value={String(d.totals.tokensIn + d.totals.tokensOut)} />
            <Metric colors={colors} label="Caracteres" value={String(d.totals.characters)} />
          </View>

          {/* Atividade nos ultimos 14 dias */}
          <Section colors={colors} icon="clock.fill" title="Atividade (14 dias)">
            {d.byDay.length === 0 ? (
              <Empty colors={colors} />
            ) : (
              <View style={styles.chart}>
                {d.byDay.map((x) => (
                  <View key={x.day} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <LinearGradient
                        colors={brandGradient as [string, string, ...string[]]}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 0, y: 0 }}
                        style={[styles.barFill, { height: `${Math.round((x.calls / maxDayCalls) * 100)}%` }]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.muted }]}>{x.day.slice(8, 10)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* Por operacao */}
          <Section colors={colors} icon="waveform" title="Por operação">
            {d.byOperation.length === 0 ? (
              <Empty colors={colors} />
            ) : (
              <View style={{ gap: 12 }}>
                {d.byOperation.map((op) => (
                  <BarRow
                    key={op.operacao}
                    colors={colors}
                    label={OP_LABEL[op.operacao] ?? op.operacao}
                    meta={`${op.calls} · ${fmtUsd(op.costUsd)}`}
                    pct={op.costUsd / maxOpCost}
                  />
                ))}
              </View>
            )}
          </Section>

          {/* Por usuario */}
          <Section colors={colors} icon="person.fill" title="Por usuário">
            {d.byUser.length === 0 ? (
              <Empty colors={colors} />
            ) : (
              <View style={{ gap: 12 }}>
                {d.byUser
                  .slice()
                  .sort((a, b) => b.costUsd - a.costUsd)
                  .map((u) => (
                    <BarRow
                      key={u.userId}
                      colors={colors}
                      label={u.name || u.userId.slice(0, 8)}
                      meta={`${u.calls} · ${fmtUsd(u.costUsd)}`}
                      pct={u.costUsd / maxUserCost}
                    />
                  ))}
              </View>
            )}
          </Section>

          {/* Uso recente */}
          <Section colors={colors} icon="clock.fill" title="Uso recente">
            {d.recent.length === 0 ? (
              <Empty colors={colors} />
            ) : (
              <View style={{ gap: 8 }}>
                {d.recent.map((r, i) => (
                  <View key={i} style={[styles.recentRow, { borderColor: colors.border }]}>
                    <View style={[styles.recentDot, { backgroundColor: r.sucesso ? colors.success : colors.error }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recentTop, { color: colors.foreground }]} numberOfLines={1}>
                        {r.name || r.userId.slice(0, 8)} · {OP_LABEL[r.operacao] ?? r.operacao}
                      </Text>
                      <Text style={[styles.recentSub, { color: colors.muted }]}>{fmtDateTime(r.criadoEm)}</Text>
                    </View>
                    <Text style={[styles.recentCost, { color: colors.muted }]}>{fmtUsd(r.custoUsd)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function Metric({ colors, label, value }: { colors: ReturnType<typeof useColors>; label: string; value: string }) {
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.metricValue, { color: colors.foreground }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.metricLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Section({
  colors,
  icon,
  title,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  icon: any;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <IconSymbol name={icon} size={18} color={colors.primary} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BarRow({
  colors,
  label,
  meta,
  pct,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  meta: string;
  pct: number;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.barRowTop}>
        <Text style={[styles.barRowLabel, { color: colors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.barRowMeta, { color: colors.muted }]}>{meta}</Text>
      </View>
      <View style={[styles.hTrack, { backgroundColor: colors.background }]}>
        <LinearGradient
          colors={brandGradient as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.hFill, { width: `${Math.max(3, Math.round(pct * 100))}%` }]}
        />
      </View>
    </View>
  );
}

function Empty({ colors }: { colors: ReturnType<typeof useColors> }) {
  return <Text style={{ color: colors.muted, fontFamily: BODY_FONT, fontSize: 13, marginTop: 6 }}>Sem uso registrado ainda.</Text>;
}

const styles = StyleSheet.create({
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4, paddingBottom: 12 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: BODY_FONT, fontSize: 18, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  heroBorder: { borderRadius: 20, padding: 2 },
  heroInner: { borderRadius: 18, padding: 20, alignItems: "center" },
  heroLabel: { fontFamily: BODY_FONT, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  heroValue: { fontFamily: BODY_FONT, fontSize: 40, fontWeight: "800", marginTop: 6, fontVariant: ["tabular-nums"] },
  heroSub: { fontFamily: BODY_FONT, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "47%",
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 3,
  },
  metricValue: { fontFamily: BODY_FONT, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  metricLabel: { fontFamily: BODY_FONT, fontSize: 11, fontWeight: "600" },
  section: { borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sectionTitle: { fontFamily: BODY_FONT, fontSize: 15, fontWeight: "700" },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 110, gap: 3 },
  barCol: { flex: 1, alignItems: "center", gap: 5 },
  barTrack: { width: "70%", height: 88, justifyContent: "flex-end", borderRadius: 5, overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 5, minHeight: 3 },
  barLabel: { fontFamily: BODY_FONT, fontSize: 9, fontVariant: ["tabular-nums"] },
  barRowTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  barRowLabel: { flex: 1, fontFamily: BODY_FONT, fontSize: 14, fontWeight: "600" },
  barRowMeta: { fontFamily: BODY_FONT, fontSize: 12, fontVariant: ["tabular-nums"] },
  hTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  hFill: { height: "100%", borderRadius: 5 },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentTop: { fontFamily: BODY_FONT, fontSize: 13, fontWeight: "600" },
  recentSub: { fontFamily: BODY_FONT, fontSize: 11, marginTop: 1, fontVariant: ["tabular-nums"] },
  recentCost: { fontFamily: BODY_FONT, fontSize: 12, fontVariant: ["tabular-nums"] },
});
