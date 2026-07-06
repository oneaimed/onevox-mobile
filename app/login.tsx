import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { OneVoxWordmark } from "@/components/brand/brand-bits";
import { GradientButton } from "@/components/brand/gradient-button";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-context";

export default function LoginScreen() {
  const colors = useColors();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("Preencha email e senha.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError("Email ou senha invalidos.");
    // Sucesso: o portao em app/_layout redireciona automaticamente para as abas.
  };

  return (
    <ScreenContainer className="px-6" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.center}>
          <View style={styles.header}>
            <OneVoxWordmark size={38} subtitle="COMUNICAÇÃO COM SUA VOZ" />
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>Email</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>Senha</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              placeholderTextColor={colors.muted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              onSubmitEditing={handleLogin}
              returnKeyType="go"
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

          <GradientButton
            label={loading ? undefined : "Entrar"}
            loading={loading}
            onPress={handleLogin}
            style={styles.button}
          />

          <Text style={[styles.note, { color: colors.muted }]}>
            Sua conta e criada pela equipe OneVox.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 36 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8, marginLeft: 4 },
  inputWrap: { borderWidth: 1, borderRadius: 14 },
  input: { height: 56, paddingHorizontal: 16, fontSize: 16, fontWeight: "500" },
  error: { marginTop: 14, fontSize: 14, textAlign: "center" },
  button: { marginTop: 24 },
  note: { marginTop: 20, fontSize: 13, textAlign: "center" },
});
