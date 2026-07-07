// Cliente Supabase do FRONTEND (Expo/React Native + web).
// Usa a ANON KEY (publica) — protegida por RLS no banco. NUNCA a service role aqui.
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anon) {
  // Nao lanca nem quebra o build: o static render do Expo executa este modulo
  // em build time. Sem as EXPO_PUBLIC_* setadas, cai num placeholder so pra
  // instanciar o client; em runtime (com as env na Vercel) usa os valores reais.
  console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY ausentes - usando placeholder");
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anon || "public-anon-placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
