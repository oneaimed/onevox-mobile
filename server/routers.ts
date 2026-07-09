import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { getSupabaseAdmin } from "./supabase";
import { generateSpeech, getVoice, listVoices } from "./elevenlabs";
import { interpretTextDetailed } from "./interpret";
import { storageGetSignedUrl, storageKeyFromUrl, storagePut } from "./storage";
import { logUsage } from "./usage";
import { trainingRouter } from "./training";

// Voz clonada padrao (Roberto Dias). Usada como fallback quando o perfil do
// usuario ainda nao tem elevenlabs_voice_id definido.
const DEFAULT_VOICE_ID = "GMafEIaeEWpGsrYrVqCX";

const voiceRouter = router({
  // List voices available on the ElevenLabs account.
  listVoices: protectedProcedure.query(async () => {
    return listVoices();
  }),

  // Confirm a specific voice exists / is usable.
  getVoice: protectedProcedure
    .input(z.object({ voiceId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getVoice(input.voiceId);
    }),

  // Text -> speech (cloned voice). Returns a storage url with the mp3.
  generateSpeech: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(5000),
        voiceId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const startedAt = Date.now();
      // Regra de seguranca: a voz e sempre derivada do perfil do usuario logado,
      // nunca do payload do cliente. `input.voiceId` fica so por compat do client.
      const voiceId = ctx.user?.voiceId || DEFAULT_VOICE_ID;
      try {
        const { url, key } = await generateSpeech({ text: input.text, voiceId });
        // Contabiliza uso de TTS (ElevenLabs cobra por caractere) — best-effort.
        void logUsage({
          userId: ctx.user?.id ?? null,
          provider: "elevenlabs",
          operation: "tts",
          characters: input.text.length,
          latencyMs: Date.now() - startedAt,
          detail: { voiceId },
        });
        return { url, key };
      } catch (error) {
        void logUsage({
          userId: ctx.user?.id ?? null,
          provider: "elevenlabs",
          operation: "tts",
          characters: input.text.length,
          latencyMs: Date.now() - startedAt,
          success: false,
          detail: { voiceId, error: error instanceof Error ? error.message : String(error) },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "TTS failed",
        });
      }
    }),

  // Interpret/rewrite raw text into a clean, speakable sentence.
  interpret: protectedProcedure
    .input(z.object({ text: z.string().min(1).max(5000) }))
    .mutation(async ({ input, ctx }) => {
      const startedAt = Date.now();
      try {
        const { text, usage } = await interpretTextDetailed(input.text);
        // Contabiliza uso de correcao (tokens OpenAI) por usuario — best-effort.
        void logUsage({
          userId: ctx.user?.id ?? null,
          provider: "openai",
          operation: "correcao",
          tokensIn: usage?.tokensIn,
          tokensOut: usage?.tokensOut,
          latencyMs: Date.now() - startedAt,
        });
        return { text };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Interpretation failed",
        });
      }
    }),

  // Upload a recorded audio (base64) and transcribe it.
  // Optionally interpret/rewrite the transcription in the same call.
  uploadAndTranscribe: protectedProcedure
    .input(
      z.object({
        audioBase64: z.string().min(1),
        mimeType: z.string().default("audio/m4a"),
        language: z.string().optional(),
        interpret: z.boolean().default(false),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // 1. Persist the audio to storage so the transcription service can fetch it.
      let audioUrl: string;
      try {
        const buffer = Buffer.from(input.audioBase64, "base64");
        const ext = input.mimeType.includes("wav")
          ? "wav"
          : input.mimeType.includes("webm")
            ? "webm"
            : input.mimeType.includes("mp3") || input.mimeType.includes("mpeg")
              ? "mp3"
              : "m4a";
        const { url } = await storagePut(`recordings/${Date.now()}.${ext}`, buffer, input.mimeType);
        // The transcription service runs server-side and needs an absolute URL.
        // Resolve the storage key to a signed (absolute) URL.
        const key = storageKeyFromUrl(url);
        audioUrl = await storageGetSignedUrl(key);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Audio upload failed",
        });
      }

      // 2. Transcribe.
      const sttStart = Date.now();
      const result = await transcribeAudio({
        audioUrl,
        language: input.language ?? "pt",
      });

      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }

      // Contabiliza uso de STT (minutos de audio) por usuario — best-effort.
      void logUsage({
        userId: ctx.user?.id ?? null,
        provider: "openai",
        operation: "stt",
        audioSeconds: result.duration,
        latencyMs: Date.now() - sttStart,
        detail: { language: result.language },
      });

      const original = result.text.trim();

      // 3. Optionally interpret/rewrite.
      let interpreted: string | null = null;
      if (input.interpret && original) {
        try {
          const interpretStart = Date.now();
          const r = await interpretTextDetailed(original);
          interpreted = r.text;
          void logUsage({
            userId: ctx.user?.id ?? null,
            provider: "openai",
            operation: "correcao",
            tokensIn: r.usage?.tokensIn,
            tokensOut: r.usage?.tokensOut,
            latencyMs: Date.now() - interpretStart,
          });
        } catch {
          interpreted = null;
        }
      }

      return {
        original,
        interpreted,
        language: result.language,
        duration: result.duration,
      };
    }),
});

// Consumo/custo por usuario, lido do Supabase (`uso`). Agregacao em JS (volumes
// de POC). Leitura administrativa (todos os usuarios) + o proprio usuario.
type UsoRow = {
  user_id?: string;
  tokens_in: number | null;
  tokens_out: number | null;
  caracteres: number | null;
  segundos_audio: number | null;
  custo_usd: number | null;
};

type Agg = {
  calls: number;
  tokensIn: number;
  tokensOut: number;
  characters: number;
  audioSeconds: number;
  costUsd: number;
};

function emptyAgg(): Agg {
  return { calls: 0, tokensIn: 0, tokensOut: 0, characters: 0, audioSeconds: 0, costUsd: 0 };
}

function accumulate(agg: Agg, r: UsoRow): void {
  agg.calls += 1;
  agg.tokensIn += Number(r.tokens_in) || 0;
  agg.tokensOut += Number(r.tokens_out) || 0;
  agg.characters += Number(r.caracteres) || 0;
  agg.audioSeconds += Number(r.segundos_audio) || 0;
  agg.costUsd += Number(r.custo_usd) || 0;
}

function finalize(agg: Agg) {
  return {
    calls: agg.calls,
    tokensIn: agg.tokensIn,
    tokensOut: agg.tokensOut,
    characters: agg.characters,
    audioSeconds: agg.audioSeconds,
    audioMinutes: Math.round((agg.audioSeconds / 60) * 100) / 100,
    costUsd: Math.round(agg.costUsd * 1e6) / 1e6,
  };
}

const usageRouter = router({
  // Resumo agregado de consumo e custo por usuario (somente admin).
  summaryByUser: adminProcedure.query(async () => {
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Supabase indisponivel" });
    }
    const { data, error } = await admin
      .from("uso")
      .select("user_id, tokens_in, tokens_out, caracteres, segundos_audio, custo_usd");
    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }

    const byUser = new Map<string, Agg>();
    for (const row of (data ?? []) as UsoRow[]) {
      const key = row.user_id ?? "";
      const agg = byUser.get(key) ?? emptyAgg();
      accumulate(agg, row);
      byUser.set(key, agg);
    }

    const { data: perfis } = await admin.from("perfis").select("id, nome");
    const nameById = new Map<string, string | null>(
      ((perfis ?? []) as { id: string; nome: string | null }[]).map((p) => [p.id, p.nome]),
    );

    return Array.from(byUser.entries()).map(([userId, agg]) => ({
      userId,
      name: nameById.get(userId) ?? null,
      ...finalize(agg),
    }));
  }),

  // Consumo do proprio usuario logado.
  mine: protectedProcedure.query(async ({ ctx }) => {
    const admin = getSupabaseAdmin();
    if (!admin) return finalize(emptyAgg());
    const { data, error } = await admin
      .from("uso")
      .select("tokens_in, tokens_out, caracteres, segundos_audio, custo_usd")
      .eq("user_id", ctx.user.id);
    if (error || !data) return finalize(emptyAgg());
    const agg = emptyAgg();
    for (const row of data as UsoRow[]) accumulate(agg, row);
    return finalize(agg);
  }),
});

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  voice: voiceRouter,
  usage: usageRouter,
  training: trainingRouter,
});

export type AppRouter = typeof appRouter;
