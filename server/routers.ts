import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { transcribeAudio } from "./_core/voiceTranscription";
import { generateSpeech, getVoice, listVoices } from "./elevenlabs";
import { interpretText } from "./interpret";
import { storageKeyFromUrl, storagePut } from "./storage";

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
    .mutation(async ({ input }) => {
      try {
        const { url, key } = await generateSpeech({
          text: input.text,
          voiceId: input.voiceId || DEFAULT_VOICE_ID,
        });
        return { url, key };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "TTS failed",
        });
      }
    }),

  // Interpret/rewrite raw text into a clean, speakable sentence.
  interpret: publicProcedure
    .input(z.object({ text: z.string().min(1).max(5000) }))
    .mutation(async ({ input }) => {
      try {
        const rewritten = await interpretText(input.text);
        return { text: rewritten };
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
    .mutation(async ({ input }) => {
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
      const result = await transcribeAudio({
        audioUrl,
        language: input.language ?? "pt",
      });

      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }

      const original = result.text.trim();

      // 3. Optionally interpret/rewrite.
      let interpreted: string | null = null;
      if (input.interpret && original) {
        try {
          interpreted = await interpretText(original);
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
});

export type AppRouter = typeof appRouter;
