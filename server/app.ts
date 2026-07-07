import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";

/**
 * Monta o app Express (tRPC + proxy de storage + health), SEM escutar porta.
 * Reaproveitado por:
 *  - server/_core/index.ts (servidor de desenvolvimento local)
 *  - api/[...path].ts (funcao serverless da Vercel em producao)
 *
 * As rotas OAuth do Manus foram removidas: a autenticacao agora e Supabase.
 */
export function createApp() {
  const app = express();

  // CORS: reflete a origem e permite credenciais. Inofensivo em same-origin
  // (front + api no mesmo dominio da Vercel).
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Proxy de storage: /api/storage/* -> redireciona pra signed URL do Supabase.
  registerStorageProxy(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  return app;
}
