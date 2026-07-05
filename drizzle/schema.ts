import {
  boolean,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Contabilizacao de uso/custo por usuario. Uma linha por chamada externa
 * (ElevenLabs TTS / OpenAI correcao / OpenAI Whisper STT).
 * Gravada de forma best-effort por server/usage.ts (nunca bloqueia a requisicao).
 */
export const usageEvents = mysqlTable(
  "usage_events",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Usuario que gerou o uso (nulo para chamadas sem sessao). */
    userId: int("userId").references(() => users.id),
    provider: mysqlEnum("provider", ["openai", "elevenlabs"]).notNull(),
    operation: mysqlEnum("operation", ["correcao", "tts", "stt"]).notNull(),
    /** Modo de correcao usado (quando aplicavel). */
    modo: int("modo"),
    /** OpenAI: tokens de entrada/saida. */
    tokensIn: int("tokensIn"),
    tokensOut: int("tokensOut"),
    /** ElevenLabs: caracteres sintetizados. */
    characters: int("characters"),
    /** STT: duracao do audio transcrito, em segundos. */
    audioSeconds: double("audioSeconds"),
    /** Custo estimado da chamada, em USD (calculado no backend). */
    costUsd: double("costUsd"),
    latencyMs: int("latencyMs"),
    success: boolean("success").default(true).notNull(),
    /** Metadados extras (modelo, voiceId, erro, idioma...). */
    detail: json("detail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("usage_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type InsertUsageEvent = typeof usageEvents.$inferInsert;
