// Registro de uso por usuario (minutos de audio + tokens) e custo estimado, no
// Supabase (tabela `uso`). BEST-EFFORT: esta funcao NUNCA lanca. Uma falha ao
// registrar uso nao pode, em hipotese alguma, derrubar a chamada principal
// (TTS/STT/correcao).
import { getSupabaseAdmin } from "./supabase";
import { calcularCustoUsd } from "./precos";

export type LogUsageInput = {
  userId?: string | null; // uuid do usuario logado (auth.users.id)
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
    const admin = getSupabaseAdmin();
    // Sem Supabase configurado: apenas nao registra (o fluxo do app segue normal).
    if (!admin) return;
    // uso.user_id e NOT NULL: so registra chamadas atribuidas a um usuario logado.
    if (!ev.userId) return;

    const costUsd =
      ev.costUsd ??
      calcularCustoUsd({
        operation: ev.operation,
        tokensIn: ev.tokensIn,
        tokensOut: ev.tokensOut,
        characters: ev.characters,
        audioSeconds: ev.audioSeconds,
      });

    const { error } = await admin.from("uso").insert({
      user_id: ev.userId,
      provedor: ev.provider,
      operacao: ev.operation,
      modo: ev.modo ?? null,
      tokens_in: ev.tokensIn ?? null,
      tokens_out: ev.tokensOut ?? null,
      caracteres: ev.characters ?? null,
      segundos_audio: ev.audioSeconds ?? null,
      custo_usd: costUsd ?? null,
      latencia_ms: ev.latencyMs ?? null,
      sucesso: ev.success ?? true,
      detalhe: ev.detail ?? null,
    });
    if (error) console.error("[logUsage]", error.message);
  } catch (err) {
    console.error("[logUsage]", err instanceof Error ? err.message : err);
  }
}
