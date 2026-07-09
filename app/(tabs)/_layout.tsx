import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 8);
  const tabBarOffset = Platform.OS === "web" ? 10 : 0;
  const tabBarHeight = 64 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          transform: [{ translateY: tabBarOffset }],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Teclado",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="keyboard" color={color} />,
        }}
      />
      <Tabs.Screen
        name="gravar"
        options={{
          title: "Gravar",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="mic.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="frases"
        options={{
          title: "Frases",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="text.bubble.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="treino"
        options={{
          title: "Treino",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="graduationcap.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
