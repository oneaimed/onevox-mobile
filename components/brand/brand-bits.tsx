import React from "react";
import { Image, StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

import { brandGradient } from "@/theme.config";

const ONEAI_SHIELD = require("@/assets/images/Logo OneAI só escudo.jpeg");

/**
 * Wordmark "OneVox" — enxuto, uma linha. Passe subtitle so quando fizer sentido.
 */
export function OneVoxWordmark({ size = 24, subtitle }: { size?: number; subtitle?: string }) {
  return (
    <View style={styles.wordmarkWrap}>
      <View style={styles.row}>
        <Text style={[styles.word, { fontSize: size }]}>One</Text>
        <Text style={[styles.vox, { fontSize: size }]}>Vox</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/**
 * Rodape discreto "powered by One AI" com o escudo pequeno.
 */
export function PoweredByOneAI({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.poweredWrap, style]}>
      <Text style={styles.poweredText}>powered by</Text>
      <Image source={ONEAI_SHIELD} style={styles.poweredLogo} resizeMode="cover" />
      <Text style={styles.poweredBrand}>One AI</Text>
    </View>
  );
}

/**
 * Text painted with the brand gradient using a mask.
 */
export function GradientText({ text, style }: { text: string; style?: TextStyle }) {
  return (
    <MaskedView maskElement={<Text style={[style, { backgroundColor: "transparent" }]}>{text}</Text>}>
      <LinearGradient
        colors={brandGradient as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, { opacity: 0 }]}>{text}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/**
 * A view wrapped with a gradient border (used for highlighted cards/inputs).
 */
export function GradientBorder({
  children,
  borderWidth = 1.5,
  radius = 20,
  style,
  active = true,
}: {
  children: React.ReactNode;
  borderWidth?: number;
  radius?: number;
  style?: ViewStyle;
  active?: boolean;
}) {
  if (!active) {
    return (
      <View style={[{ borderRadius: radius, borderWidth, borderColor: "#22354F" }, style]}>{children}</View>
    );
  }
  return (
    <LinearGradient
      colors={brandGradient as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius, padding: borderWidth }, style]}
    >
      <View style={{ borderRadius: radius - borderWidth, backgroundColor: "#101F38", overflow: "hidden" }}>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wordmarkWrap: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  word: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  vox: {
    color: "#34D8A0",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#8A9BB5",
    fontSize: 11,
    marginTop: 1,
    letterSpacing: 1.5,
  },
  poweredWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  poweredText: {
    color: "#5E6E88",
    fontSize: 11,
    fontWeight: "500",
  },
  poweredLogo: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  poweredBrand: {
    color: "#8A9BB5",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
