// Cliente Supabase do BACKEND (service role). Ignora RLS — NUNCA expor no frontend.
// Usado para: verificar o token do usuario (auth.getUser), ler/gravar perfis e uso.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./_core/env";

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = ENV.supabaseUrl;
  const key = ENV.supabaseServiceRoleKey;
  if (!url || !key) {
    console.warn("[Supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
    return null;
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}
