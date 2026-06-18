import React from "react";
import { Image, StyleSheet, Text, View, type ViewStyle, type TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";

import { brandGradient } from "@/theme.config";

const ONEAI_LOGO = require("@/assets/images/oneai-logo.png");

/**
 * Wordmark with the OneAI logo, "OneVox" (Vox in brand gradient) and a "Mobile" pill.
 */
export function OneVoxWordmark({ size = 28, subtitle }: { size?: number; subtitle?: string }) {
  const logoSize = Math.round(size * 1.5);
  return (
    <View style={styles.wordmarkWrap}>
      <View style={styles.row}>
        <Image
          source={ONEAI_LOGO}
          style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 2, marginRight: 10 }}
          resizeMode="cover"
        />
        <Text style={[styles.word, { fontSize: size }]}>One</Text>
        <GradientText text="Vox" style={{ fontSize: size, fontWeight: "800" }} />
        <View style={styles.mobilePill}>
          <Text style={[styles.mobileText, { fontSize: Math.round(size * 0.42) }]}>MOBILE</Text>
        </View>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
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
  },
  word: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  mobilePill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#34D8A0",
    alignSelf: "center",
  },
  mobileText: {
    color: "#34D8A0",
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  subtitle: {
    color: "#8A9BB5",
    fontSize: 13,
    marginTop: 2,
    letterSpacing: 1,
  },
});
