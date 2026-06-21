// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // Tab bar
  "keyboard": "keyboard",
  "mic.fill": "mic",
  "text.bubble.fill": "chat-bubble",
  "person.fill": "person",
  // UI actions
  "speaker.wave.2.fill": "volume-up",
  "play.fill": "play-arrow",
  "pause.fill": "pause",
  "stop.fill": "stop",
  "trash": "delete-outline",
  "arrow.uturn.backward": "undo",
  "square.and.arrow.up": "ios-share",
  "checkmark": "check",
  "xmark": "close",
  "sparkles": "auto-awesome",
  "wand.and.stars": "auto-fix-high",
  "plus": "add",
  "pencil": "edit",
  "gearshape.fill": "settings",
  "waveform": "graphic-eq",
  "heart.fill": "favorite",
  "cross.case.fill": "medical-services",
  "hand.raised.fill": "front-hand",
  "bubble.left.fill": "forum",
  "exclamationmark.triangle.fill": "warning",
  "clock.fill": "history",
  "questionmark.circle": "help-outline",
  "accessibility": "accessibility-new",
  "textformat.size": "format-size",
  "chevron.right.circle": "chevron-right",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
