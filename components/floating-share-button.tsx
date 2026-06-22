import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, PanResponder, Platform, Share, StyleSheet, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { brandGradient } from "@/theme.config";

export function FloatingShareButton({ audioUrl }: { audioUrl: string }) {
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
        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = "onevox-audio.mp3";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const canShareFile = await Sharing.isAvailableAsync();
      if (canShareFile) {
        const fileUri = `${FileSystem.cacheDirectory}onevox-audio-${Date.now()}.mp3`;
        const result = await FileSystem.downloadAsync(audioUrl, fileUri);
        await Sharing.shareAsync(result.uri, {
          dialogTitle: "Compartilhar audio OneVox",
          mimeType: "audio/mpeg",
          UTI: "public.mp3",
        });
        return;
      }

      await Share.share({
        title: "Audio OneVox",
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

const styles = StyleSheet.create({
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
