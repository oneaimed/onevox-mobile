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

// No build (static render do Expo) nao existe `window`: o AsyncStorage-web usa
// window.localStorage e quebraria ao instanciar o GoTrue. So habilita storage/
// persistencia no browser (runtime); no build usa um client leve e descartavel.
const isBrowser = typeof window !== "undefined";

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anon || "public-anon-placeholder",
  {
    auth: isBrowser
      ? {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        }
      : {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
  },
);
