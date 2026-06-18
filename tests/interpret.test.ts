import { describe, expect, it } from "vitest";

import { interpretText } from "../server/interpret";

// These tests exercise the AI rewrite pipeline used by the Teclado and Gravar tabs.
// They rely on the built-in server LLM (no external key required).
describe("AI interpretation / rewrite", () => {
  it("returns empty string for empty input", async () => {
    const out = await interpretText("   ");
    expect(out).toBe("");
  });

  it("rewrites a messy input into a clean Portuguese sentence", async () => {
    const messy = "eu ta com mta sde qero agua plis";
    const out = await interpretText(messy);

    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toBe(messy);
    expect(out.toLowerCase()).toMatch(/água|agua|sede/);
  }, 30000);

  it("does NOT answer the user — only reconstructs intent (question stays a question)", async () => {
    const out = await interpretText("ola tdo bem cm vc hj");
    // Must remain a greeting/question, not a reply like "Estou bem".
    expect(out.toLowerCase()).toMatch(/tudo bem|como|olá|ola/);
    expect(out.toLowerCase()).not.toMatch(/estou bem|recebi sua mensagem/);
  }, 30000);

  it("logs reconstruction of the hard real-world sample (image 4)", async () => {
    const hard =
      "letrcia rrcenoimamrnrnssgemuiyofeia vouredpondes paja bocê vom catinjo tufo munfopodetetptovblrmas e csminjosfificeisna vida euporexrmplo gifiwurisrm falsr eguiavonsrljado prlodrsvsty para tetar sptrndr ia ontrlihrnvia aryigivial";
    const out = await interpretText(hard);
    // We can't assert exact text, but it must produce a non-empty Portuguese sentence
    // and must NOT be the chatbot-style reply we saw before.
    expect(out.length).toBeGreaterThan(10);
    expect(out.toLowerCase()).not.toMatch(/fui criado para ser uma inteligência artificial/);
    // Surface the result for manual inspection.
    console.log("\n[HARD SAMPLE RECONSTRUCTION]\n", out, "\n");
  }, 45000);
});
