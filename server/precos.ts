// Precos estimados dos provedores, em USD.
// AJUSTE conforme o plano/faturamento real — estes sao valores de referencia.
// Centralizado aqui para o custo por chamada ser calculado num so lugar.
export const PRECOS = {
  // OpenAI gpt-4o-mini (correcao de texto) — por 1 milhao de tokens
  openai_correcao: { inputPorMTok: 0.15, outputPorMTok: 0.6 },
  // OpenAI Whisper (STT) — por segundo de audio (~US$0.006/min de referencia)
  openai_transcribe: { porSegundo: 0.0001 },
  // ElevenLabs TTS — por caractere (varia MUITO por plano)
  elevenlabs_tts: { porCaractere: 0.00018 },
};

export type CustoInput = {
  operation: "correcao" | "tts" | "stt";
  tokensIn?: number;
  tokensOut?: number;
  characters?: number;
  audioSeconds?: number;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Custo estimado da chamada em USD, a partir das metricas registradas. */
export function calcularCustoUsd(e: CustoInput): number | undefined {
  switch (e.operation) {
    case "correcao": {
      const i = ((e.tokensIn ?? 0) / 1e6) * PRECOS.openai_correcao.inputPorMTok;
      const o = ((e.tokensOut ?? 0) / 1e6) * PRECOS.openai_correcao.outputPorMTok;
      return round6(i + o);
    }
    case "stt":
      return round6((e.audioSeconds ?? 0) * PRECOS.openai_transcribe.porSegundo);
    case "tts":
      return round6((e.characters ?? 0) * PRECOS.elevenlabs_tts.porCaractere);
    default:
      return undefined;
  }
}
