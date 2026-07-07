// Funcao serverless da Vercel: atende TODO o /api (tRPC + storage proxy + health)
// reaproveitando o mesmo app Express do servidor de desenvolvimento.
//
// As variaveis de ambiente (SUPABASE_*, OPENAI_API_KEY, ELEVENLABS_API_KEY,
// JWT_SECRET) vem das Environment Variables do projeto na Vercel, nao de .env.
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../server/app";

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // A funcao esta montada em /api; dependendo do roteamento da Vercel o path
  // pode chegar sem o prefixo. Garante que o Express (rotas em /api/...) case.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
