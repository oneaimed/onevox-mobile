# Context — OneVox Mobile (oneaimed)
> Atualizado: 2026-07-06

## Estado atual

App **Expo/React Native** (exportado como PWA) da One AI. A `main` esta funcional
(auth Manus OAuth + backend tRPC/Express + MySQL/Drizzle + Supabase Storage; deploy
frontend Vercel, servidor Railway).

**Em andamento (branch `feat/migracao-supabase-serverless`):** migracao pra stack
independente **Vercel serverless + Supabase (Auth + Postgres + Storage)**, dropando
Railway, Manus e MySQL. Foco: simplicidade, entrega, escalar sem fricao, seguranca.

Progresso da migracao (branch, local, sem push):
- Etapa 1 (fundacao Supabase): clientes front/back, schema `perfis`+`uso`, `.env.example`.
- Etapa 2a (auth frontend): `useAuth` (Supabase), tela de login, portao no `_layout`.
- Supabase provisionado e validado (2026-07-07): Auth email/senha ON, `perfis`+`uso`+RLS.
- Etapa 2b/3 (auth backend + medicao) FEITAS em codigo (falta build/teste): backend valida
  token Supabase (`server/_core/auth-supabase.ts` -> `ctx.user` uuid+voice_id+role),
  rotas de voz/IA agora sao `protectedProcedure`, voz derivada do perfil (nunca do payload),
  medicao grava/le do Supabase `uso`, front (`lib/trpc.ts`) manda o token, logout no Perfil.

## Ultima sessao — 2026-07-06

- Feito: fundacao Supabase (commit 62f7cec) + auth frontend/login/portao (60686fd);
  medicao de uso por usuario ja existia na `main` em MySQL (commit 3a93a72) e sera
  refeita em Postgres. `.gitignore` endurecido pra proteger `.env`.
- Decisoes: Vercel serverless + Supabase, sem Railway/Manus/MySQL (ver tabela).
- Parou em: Etapas 2b+3 escritas (auth backend Supabase + medicao em `uso`). Ainda NAO
  buildadas/testadas (sem `node_modules` no ambiente Claude). Proximo: `pnpm install` ->
  `pnpm check` (tsc) -> criar conta de teste com `voice_id` -> `pnpm dev` e validar login,
  fala e gravacao em `uso`. Depois Etapa 4 (serverless Vercel + remover codigo morto Manus/
  MySQL). Segredos so no `.env` (gitignored), NUNCA no chat/commit.

## Decisoes tecnicas

| Decisao | Justificativa | Data |
|---|---|---|
| Vercel serverless + Supabase; dropar Railway | Simplicidade + custo ~0 + independencia; request/resposta e ideal pra serverless | 2026-07 |
| Dropar Manus (OAuth/SDK/forge) | Programa livre e independente | 2026-07 |
| Dropar MySQL/Drizzle → Supabase Postgres | Banco unico no Supabase | 2026-07 |
| Auth email/senha via Supabase Auth | Espelha o que funcionou no app cassiano; portao ligado (todos precisam de conta, cada um com voice_id) | 2026-07 |
| Manter tRPC (rodando como funcao serverless) | Reaproveita o backend/telas; so muda hospedagem | 2026-07 |
| Segredos so em `.env` (gitignored) / env da Vercel | Seguranca de dados; PAT de conta e amplo demais — usar chaves de projeto | 2026-07 |

## Arquitetura (alvo)

```
Expo (PWA) --HTTPS--> Vercel Functions (tRPC serverless, guarda chaves)
                         |-- OpenAI (correcao/STT) + ElevenLabs (TTS voz clonada)
                         |-- Supabase Postgres (perfis[voice_id], uso)
Supabase Auth (email/senha) = identidade;  Supabase Storage = audios
```

Ver `supabase/migrations/0001_init.sql` (perfis+uso+RLS) e `todo.md` (etapas).
