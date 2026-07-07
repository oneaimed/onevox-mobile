// Autenticacao via Supabase Auth. Verifica o access token (Bearer) enviado pelo
// frontend, carrega o perfil do usuario (voice_id, modo) e monta o AppUser usado
// no contexto tRPC. Substitui o fluxo Manus/MySQL (sdk.authenticateRequest), que
// sera removido na limpeza (Etapa 4).
import type { Request } from "express";
import { ENV } from "./env";
import { getSupabaseAdmin } from "../supabase";

export type AppUser = {
  id: string; // uuid (auth.users.id == perfis.id)
  email: string | null;
  name: string | null;
  role: "user" | "admin";
  voiceId: string | null; // perfis.elevenlabs_voice_id
  modo: number; // perfis.modo_preferido (1=literal, 2=corrige+confere, 3=auto)
  ativo: boolean;
};

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization || req.headers.Authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) {
    const t = h.slice("Bearer ".length).trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

/**
 * Retorna o usuario autenticado a partir do token do Supabase, ou null.
 * Auth e opcional aqui: o gate de "exige sessao" fica no protectedProcedure/
 * adminProcedure. Nao lanca (erros de rede sobem e o context.ts trata).
 */
export async function authenticateSupabase(req: Request): Promise<AppUser | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const admin = getSupabaseAdmin();
  if (!admin) {
    console.warn("[Auth] Supabase admin indisponivel (checar SUPABASE_URL / SERVICE_ROLE_KEY)");
    return null;
  }

  // Valida o JWT do usuario contra o Supabase.
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const authUser = data.user;

  // Perfil (voice_id, modo). Criado automaticamente pelo trigger handle_new_user.
  const { data: perfil } = await admin
    .from("perfis")
    .select("nome, elevenlabs_voice_id, modo_preferido, ativo")
    .eq("id", authUser.id)
    .maybeSingle();

  const email = authUser.email ?? null;
  const role: "user" | "admin" =
    email && ENV.adminEmails.includes(email.toLowerCase()) ? "admin" : "user";

  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;

  return {
    id: authUser.id,
    email,
    name: perfil?.nome ?? (typeof meta.nome === "string" ? meta.nome : null),
    role,
    voiceId: perfil?.elevenlabs_voice_id ?? null,
    modo: perfil?.modo_preferido ?? 2,
    ativo: perfil?.ativo ?? true,
  };
}
