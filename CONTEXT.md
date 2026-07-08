# Context — OneVox Mobile (oneaimed)
> Atualizado: 2026-07-06

## Estado atual

App **Expo/React Native** (exportado como PWA) da One AI, na stack
**Vercel serverless + Supabase (Auth + Postgres + Storage)**. A migracao (que dropou
Railway, Manus e MySQL do fluxo) foi concluida e **deployada em producao** (`main`) em
2026-07-07. URL de producao: **onevox-mobile-lac.vercel.app** (o `onevox-mobile.vercel.app`
SEM `-lac` e OUTRO projeto/app antigo do cassiano — ignorar).

Migracao concluida (etapas 1-4), no ar:
- Auth: Supabase email/senha; portao no `_layout` (sem sessao -> /login); backend valida
  o token via `server/_core/auth-supabase.ts` -> `ctx.user` (uuid + voice_id + role).
- Rotas de voz/IA sao `protectedProcedure`; voz derivada do perfil (nunca do payload).
- Medicao grava/le do Supabase `uso` (MySQL/Drizzle aposentado no fluxo).
- Host: funcao serverless `api/index.ts` (Express compartilhado em `server/app.ts`),
  roteada por rewrite `/api/(.*)` -> `/api` no `vercel.json`; frontend chama `/api` relativo.
  (O catch-all de arquivo `api/[...path].ts` so casava 1 segmento na Vercel -> trocado.)
- Validado em producao (2026-07-07): login OK; `/api/trpc` responde JSON; UNAUTHORIZED/RLS OK.

## Ultima sessao — 2026-07-06

- Feito: fundacao Supabase (commit 62f7cec) + auth frontend/login/portao (60686fd);
  medicao de uso por usuario ja existia na `main` em MySQL (commit 3a93a72) e sera
  refeita em Postgres. `.gitignore` endurecido pra proteger `.env`.
- Decisoes: Vercel serverless + Supabase, sem Railway/Manus/MySQL (ver tabela).
- Etapas 2b+3+4 escritas (auth backend Supabase, medicao em `uso`, host serverless).
  Etapa 4: `server/app.ts` (app Express compartilhado, sem OAuth Manus), `api/[...path].ts`
  (funcao serverless Vercel que serve todo o /api reusando o app), `index.ts` refatorado.
- Parou em (2026-07-07): migracao no ar em producao; login validado. Contas de teste criadas
  via admin API (Cassiano + Yasmin, perfis com voice_id=null -> fallback). FALTA: (1) confirmar
  o "falar" ponta a ponta (precisa `OPENAI_API_KEY`+`ELEVENLABS_API_KEY` no escopo Production +
  redeploy); (2) clonar as vozes no ElevenLabs e preencher `perfis.elevenlabs_voice_id`;
  (3) limpeza de codigo morto (Manus: sdk/oauth/manus-runtime/constants oauth; MySQL: db.ts/
  drizzle/schema/mysql2) e desligar o Railway. Notas de deploy: Vercel usa `pnpm install
  --no-frozen-lockfile` (maquina institucional nao alcanca o registry npm p/ rodar local);
  build quebrava no static render do Expo (createClient/AsyncStorage tocam window) -> guardado
  em `lib/supabase.ts` (storage/persistSession so no browser). Segredos so no painel Vercel/`.env`.

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
