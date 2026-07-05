// Registro de uso por usuario (minutos de audio + tokens) e custo estimado.
// BEST-EFFORT: esta funcao NUNCA lanca. Uma falha ao registrar uso nao pode,
// em hipotese alguma, derrubar a chamada principal (TTS/STT/correcao).
import { usageEvents } from "../drizzle/schema";
import { getDb } from "./db";
import { calcularCustoUsd } from "./precos";

export type LogUsageInput = {
  userId?: number | null;
  provider: "openai" | "elevenlabs";
  operation: "correcao" | "tts" | "stt";
  modo?: number | null;
  tokensIn?: number;
  tokensOut?: number;
  characters?: number;
  audioSeconds?: number;
  costUsd?: number;
  latencyMs?: number;
  success?: boolean;
  detail?: Record<string, unknown>;
};

export async function logUsage(ev: LogUsageInput): Promise<void> {
  try {
    const db = await getDb();
    // Sem banco configurado: apenas nao registra (o fluxo do app segue normal).
    if (!db) return;

    const costUsd =
      ev.costUsd ??
      calcularCustoUsd({
        operation: ev.operation,
        tokensIn: ev.tokensIn,
        tokensOut: ev.tokensOut,
        characters: ev.characters,
        audioSeconds: ev.audioSeconds,
      });

    await db.insert(usageEvents).values({
      userId: ev.userId ?? null,
      provider: ev.provider,
      operation: ev.operation,
      modo: ev.modo ?? null,
      tokensIn: ev.tokensIn ?? null,
      tokensOut: ev.tokensOut ?? null,
      characters: ev.characters ?? null,
      audioSeconds: ev.audioSeconds ?? null,
      costUsd: costUsd ?? null,
      latencyMs: ev.latencyMs ?? null,
      success: ev.success ?? true,
      detail: ev.detail ?? null,
    });
  } catch (err) {
    console.error("[logUsage]", err instanceof Error ? err.message : err);
  }
}
