// AI interpretation/rewrite helpers (server-side only).
import { invokeLLM } from "./_core/llm";

/**
 * The OneVox rewrite engine. This is NOT a chatbot: it must NEVER answer, reply to,
 * or continue the user's text. Its only job is to reconstruct, as faithfully as
 * possible, the sentence the user was *trying* to write/say, fixing typos, phonetic
 * spellings, missing letters and word boundaries caused by motor or speech limitations.
 *
 * Users of this app (e.g. people with ALS) type with great difficulty: the input may
 * be a dense stream of misspelled, run-together words. The model must decode the
 * intended meaning and output a clean, natural first-person Brazilian Portuguese
 * sentence — and nothing else.
 */
const SYSTEM_PROMPT = `Você é o motor de reconstrução de texto do app OneVox, uma ferramenta de comunicação assistiva para pessoas com dificuldade motora ou de fala (ex.: ELA/ALS). O usuário digita ou fala com muito esforço, então a entrada chega cheia de erros de digitação, letras trocadas, palavras grudadas, grafias fonéticas e trechos incompletos.

SUA ÚNICA FUNÇÃO é DECODIFICAR e RECONSTRUIR a frase que o usuário ESTAVA TENTANDO escrever, na primeira pessoa, em português do Brasil claro e natural.

REGRAS ABSOLUTAS:
1. NUNCA responda, comente, cumprimente ou continue a mensagem. Você NÃO é um assistente de conversa. Se a entrada for "como vc esta", a saída é "Como você está?" — e NÃO "Estou bem, obrigado".
2. Reconstrua a intenção ORIGINAL do usuário. Trate a entrada como uma transcrição corrompida de uma frase real que precisa ser recuperada.
3. Use pistas fonéticas e de teclado para adivinhar a palavra pretendida (ex.: "agua" -> "água"; "qero" -> "quero"; "vc"/"bocê" -> "você"; "mta"/"mto" -> "muita/muito"; "plis" -> "por favor"; "tetar" -> "testar"; "sptrndr" pode ser "se prender/aprender" conforme o contexto).
4. Junte ou separe palavras grudadas usando o contexto da frase inteira.
5. NÃO invente fatos, nomes, números ou ideias que não estejam implícitos na entrada. Se uma parte for irrecuperável, escolha a interpretação mais provável e plausível dentro do contexto, mantendo a frase curta.
6. Preserve o tom e a intenção (pergunta, pedido, afirmação). Mantenha pontuação adequada.
7. A saída será LIDA EM VOZ ALTA: seja conciso, direto e em primeira pessoa quando aplicável.
8. Responda APENAS com a frase reconstruída final. Sem aspas, sem explicações, sem prefixos.

EXEMPLOS:
Entrada: "eu ta com mta sde qero agua plis"
Saída: "Estou com muita sede, quero água, por favor."

Entrada: "ola tdo bem cm vc hj"
Saída: "Olá, tudo bem com você hoje?"

Entrada: "pf cham o medco to com dor"
Saída: "Por favor, chame o médico, estou com dor."`;

/**
 * Rewrite/interpret a raw text (typed or transcribed) into a clean, speakable sentence
 * that faithfully reconstructs the user's intended message.
 */
export async function interpretText(raw: string): Promise<string> {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const response = await invokeLLM({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Reconstrua a frase que esta pessoa tentou escrever (NÃO responda a ela):\n\n"${trimmed}"`,
      },
    ],
    // Low temperature equivalent via deterministic instruction; keep output tight.
    maxTokens: 400,
  });

  const content = response?.choices?.[0]?.message?.content;
  const result = typeof content === "string" ? content.trim() : "";
  // Strip accidental wrapping quotes if the model added them.
  const cleaned = result.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  return cleaned || trimmed;
}
