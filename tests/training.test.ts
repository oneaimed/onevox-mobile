import { describe, expect, it } from "vitest";

import { extFromMime, trainingStorageKey } from "../server/training";

// Logica pura da aba Treino (sem rede/Supabase): derivacao de extensao a partir
// do mime type gravado e o caminho de storage que vincula falante + frase.
describe("treino: extFromMime", () => {
  it("mapeia os formatos de gravacao suportados", () => {
    expect(extFromMime("audio/wav")).toBe("wav");
    expect(extFromMime("audio/webm;codecs=opus")).toBe("webm");
    expect(extFromMime("audio/ogg")).toBe("ogg");
    expect(extFromMime("audio/mpeg")).toBe("mp3");
    expect(extFromMime("audio/mp3")).toBe("mp3");
    expect(extFromMime("audio/m4a")).toBe("m4a");
  });

  it("usa m4a como padrao para mime desconhecido/vazio", () => {
    expect(extFromMime("")).toBe("m4a");
    expect(extFromMime("application/octet-stream")).toBe("m4a");
  });
});

describe("treino: trainingStorageKey", () => {
  it("agrupa o audio por usuario e por frase", () => {
    const key = trainingStorageKey("user-123", 42, 1700000000000, "m4a");
    expect(key).toBe("treino/user-123/42/1700000000000.m4a");
  });

  it("preserva a extensao informada", () => {
    expect(trainingStorageKey("u", 1, 1, "webm")).toBe("treino/u/1/1.webm");
  });
});
