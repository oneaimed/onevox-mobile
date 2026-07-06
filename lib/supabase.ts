// Cliente Supabase do FRONTEND (Expo/React Native + web).
// Usa a ANON KEY (publica) — protegida por RLS no banco. NUNCA a service role aqui.
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anon) {
  // Nao lanca: deixa o app subir; o login falha com mensagem clara se faltar config.
  console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY ausentes");
}

export const supabase = createClient(url, anon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
