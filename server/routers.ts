import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";

import { COOKIE_NAME } from "../shared/const.js";
import { usageEvents, users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { getDb } from "./db";
import { generateSpeech, getVoice, listVoices } from "./elevenlabs";
import { interpretTextDetailed } from "./interpret";
import { storageKeyFromUrl, storagePut } from "./storage";
import { logUsage } from "./usage";

// Default cloned voice (Roberto Dias). Can be overridden per request from the client.
const DEFAULT_VOICE_ID = "GMafEIaeEWpGsrYrVqCX";

const voiceRouter = router({
  // List voices available on the ElevenLabs account.
  listVoices: publicProcedure.query(async () => {
    return listVoices();
  }),

  // Confirm a specific voice exists / is usable.
  getVoice: publicProcedure
    .input(z.object({ voiceId: z.string().min(1) }))
    .query(async ({ input }) => {
      return getVoice(input.voiceId);
    }),

  // Text -> speech (cloned voice). Returns a storage url with the mp3.
  generateSpeech: publicProcedure
    .input(
      z.object({
        text: z.string().min(1).max(5000),
        voiceId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const startedAt = Date.now();
      const voiceId = input.voiceId || DEFAULT_VOICE_ID;
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
  interpret: publicProcedure
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
  uploadAndTranscribe: publicProcedure
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
        const { storageGetSignedUrl } = await import("./storage");
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

// Consumo/custo por usuario. Leitura administrativa + o proprio usuario.
const usageRouter = router({
  // Resumo agregado de consumo e custo por usuario (somente admin).
  summaryByUser: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponivel" });
    }
    const rows = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        calls: sql<number>`count(${usageEvents.id})`,
        tokensIn: sql<number>`coalesce(sum(${usageEvents.tokensIn}), 0)`,
        tokensOut: sql<number>`coalesce(sum(${usageEvents.tokensOut}), 0)`,
        characters: sql<number>`coalesce(sum(${usageEvents.characters}), 0)`,
        audioSeconds: sql<number>`coalesce(sum(${usageEvents.audioSeconds}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageEvents.costUsd}), 0)`,
      })
      .from(usageEvents)
      .leftJoin(users, eq(users.id, usageEvents.userId))
      .groupBy(users.id, users.name, users.email);

    return rows.map((r) => {
      const audioSeconds = Number(r.audioSeconds) || 0;
      return {
        userId: r.userId,
        name: r.name,
        email: r.email,
        calls: Number(r.calls) || 0,
        tokensIn: Number(r.tokensIn) || 0,
        tokensOut: Number(r.tokensOut) || 0,
        characters: Number(r.characters) || 0,
        audioSeconds,
        audioMinutes: Math.round((audioSeconds / 60) * 100) / 100,
        costUsd: Math.round((Number(r.costUsd) || 0) * 1e6) / 1e6,
      };
    });
  }),

  // Consumo do proprio usuario logado.
  mine: protectedProcedure.query(async ({ ctx }) => {
    const empty = {
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
      characters: 0,
      audioSeconds: 0,
      audioMinutes: 0,
      costUsd: 0,
    };
    const db = await getDb();
    if (!db) return empty;
    const rows = await db
      .select({
        calls: sql<number>`count(${usageEvents.id})`,
        tokensIn: sql<number>`coalesce(sum(${usageEvents.tokensIn}), 0)`,
        tokensOut: sql<number>`coalesce(sum(${usageEvents.tokensOut}), 0)`,
        characters: sql<number>`coalesce(sum(${usageEvents.characters}), 0)`,
        audioSeconds: sql<number>`coalesce(sum(${usageEvents.audioSeconds}), 0)`,
        costUsd: sql<number>`coalesce(sum(${usageEvents.costUsd}), 0)`,
      })
      .from(usageEvents)
      .where(eq(usageEvents.userId, ctx.user.id));
    const r = rows[0];
    if (!r) return empty;
    const audioSeconds = Number(r.audioSeconds) || 0;
    return {
      calls: Number(r.calls) || 0,
      tokensIn: Number(r.tokensIn) || 0,
      tokensOut: Number(r.tokensOut) || 0,
      characters: Number(r.characters) || 0,
      audioSeconds,
      audioMinutes: Math.round((audioSeconds / 60) * 100) / 100,
      costUsd: Math.round((Number(r.costUsd) || 0) * 1e6) / 1e6,
    };
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
});

export type AppRouter = typeof appRouter;
