import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { TRAINING_CONSENT_VERSION } from "../shared/const.js";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";
import { getSupabaseAdmin } from "./supabase";
import { storageGetSignedUrl, storagePut } from "./storage";

// Extensao do arquivo a partir do mime type do audio gravado (web=webm/ogg,
// nativo=m4a, etc). Espelha a logica usada em voice.uploadAndTranscribe.
export function extFromMime(mimeType: string): string {
  const m = (mimeType || "").toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp3") || m.includes("mpeg")) return "mp3";
  return "m4a";
}

// Caminho da gravacao no bucket privado: agrupa por falante e por frase, o que
// deixa o dataset trivial de exportar/organizar depois.
export function trainingStorageKey(userId: string, fraseId: number, ts: number, ext: string): string {
  return `treino/${userId}/${fraseId}/${ts}.${ext}`;
}

function requireAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase indisponivel" });
  }
  return admin;
}

type FraseRow = {
  id: number;
  codigo: string;
  texto: string;
  grupo: string;
  foco: string | null;
  dificuldade: number;
  ordem: number;
  ativo?: boolean;
};

export const trainingRouter = router({
  // Estado da aba para o usuario logado: consentimento + catalogo + progresso.
  // Uma unica ida ao servidor monta a tela.
  state: protectedProcedure.query(async ({ ctx }) => {
    const admin = requireAdmin();

    const { data: perfil } = await admin
      .from("perfis")
      .select("treino_consent_versao")
      .eq("id", ctx.user.id)
      .maybeSingle();
    const consentAccepted =
      (perfil as { treino_consent_versao?: string } | null)?.treino_consent_versao ===
      TRAINING_CONSENT_VERSION;

    const { data: frasesData, error: frasesErr } = await admin
      .from("frases_treino")
      .select("id, codigo, texto, grupo, foco, dificuldade, ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    if (frasesErr) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: frasesErr.message });
    }
    const phrases = (frasesData ?? []) as FraseRow[];

    const { data: gravData } = await admin
      .from("gravacoes_treino")
      .select("frase_id")
      .eq("user_id", ctx.user.id)
      .eq("status", "ok");
    const doneIds = Array.from(
      new Set(((gravData ?? []) as { frase_id: number }[]).map((r) => r.frase_id)),
    );

    return {
      consentAccepted,
      consentVersao: TRAINING_CONSENT_VERSION,
      total: phrases.length,
      done: doneIds.length,
      phrases,
      doneIds,
    };
  }),

  // Registra o aceite do termo de consentimento (voz e dado biometrico).
  acceptConsent: protectedProcedure.mutation(async ({ ctx }) => {
    const admin = requireAdmin();
    const { error } = await admin
      .from("perfis")
      .update({
        treino_consent_versao: TRAINING_CONSENT_VERSION,
        treino_consent_em: new Date().toISOString(),
      })
      .eq("id", ctx.user.id);
    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }
    return { ok: true, versao: TRAINING_CONSENT_VERSION };
  }),

  // Sobe a gravacao (base64) e cria a linha que vincula audio <-> frase.
  // O falante (user_id) SEMPRE vem da sessao, nunca do payload.
  submitRecording: protectedProcedure
    .input(
      z.object({
        fraseId: z.number().int().positive(),
        audioBase64: z.string().min(1),
        mimeType: z.string().default("audio/m4a"),
        durationMs: z.number().int().nonnegative().optional(),
        plataforma: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const admin = requireAdmin();

      // 1. Consentimento obrigatorio.
      const { data: perfil } = await admin
        .from("perfis")
        .select("treino_consent_versao")
        .eq("id", ctx.user.id)
        .maybeSingle();
      if (
        (perfil as { treino_consent_versao?: string } | null)?.treino_consent_versao !==
        TRAINING_CONSENT_VERSION
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Consentimento de treino pendente.",
        });
      }

      // 2. Frase precisa existir e estar ativa; pega o texto para o snapshot (rotulo real).
      const { data: fraseData, error: fErr } = await admin
        .from("frases_treino")
        .select("id, codigo, texto, ativo")
        .eq("id", input.fraseId)
        .maybeSingle();
      if (fErr) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: fErr.message });
      }
      const frase = fraseData as { id: number; codigo: string; texto: string; ativo: boolean } | null;
      if (!frase || !frase.ativo) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Frase invalida ou inativa." });
      }

      // 3. Sobe o audio no bucket privado.
      const buffer = Buffer.from(input.audioBase64, "base64");
      if (buffer.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Audio vazio." });
      }
      const ext = extFromMime(input.mimeType);
      const relKey = trainingStorageKey(ctx.user.id, frase.id, Date.now(), ext);
      let storageKey: string;
      try {
        const put = await storagePut(relKey, buffer, input.mimeType);
        storageKey = put.key;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Falha ao salvar o audio",
        });
      }

      // 4. Registra a linha (vinculo audio <-> frase, com snapshot do texto).
      const { data: inserted, error: iErr } = await admin
        .from("gravacoes_treino")
        .insert({
          user_id: ctx.user.id,
          frase_id: frase.id,
          frase_codigo: frase.codigo,
          texto_snapshot: frase.texto,
          storage_key: storageKey,
          mime_type: input.mimeType,
          plataforma: input.plataforma ?? null,
          duracao_ms: input.durationMs ?? null,
          bytes: buffer.length,
          consent_versao: TRAINING_CONSENT_VERSION,
          status: "ok",
        })
        .select("id")
        .maybeSingle();
      if (iErr) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: iErr.message });
      }

      return {
        ok: true,
        gravacaoId: (inserted as { id: number } | null)?.id ?? null,
        fraseId: frase.id,
      };
    }),

  // Export do dataset para treino (somente admin): linhas + URLs assinadas.
  adminExport: adminProcedure
    .input(
      z
        .object({ signedUrlTtlSec: z.number().int().positive().max(86400).default(3600) })
        .optional(),
    )
    .query(async ({ input }) => {
      const admin = requireAdmin();
      const { data, error } = await admin
        .from("gravacoes_treino")
        .select(
          "id, user_id, frase_id, frase_codigo, texto_snapshot, storage_key, mime_type, plataforma, duracao_ms, bytes, consent_versao, status, criado_em",
        )
        .eq("status", "ok")
        .order("criado_em", { ascending: true });
      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }
      const ttl = input?.signedUrlTtlSec ?? 3600;
      const rows = await Promise.all(
        ((data ?? []) as { storage_key: string }[]).map(async (r) => {
          let audioUrl: string | null = null;
          try {
            audioUrl = await storageGetSignedUrl(r.storage_key, ttl);
          } catch {
            audioUrl = null;
          }
          return { ...r, audioUrl };
        }),
      );
      return { count: rows.length, rows };
    }),
});
