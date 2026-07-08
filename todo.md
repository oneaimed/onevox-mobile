# OneVox Mobile — TODO

## Migração para Supabase serverless — CONCLUÍDA e EM PRODUÇÃO (2026-07-07)
Stack: Vercel serverless (`api/index.ts` = Express de `server/app.ts`, rewrite `/api/(.*)`→`/api`) + Supabase (Auth + Postgres + Storage). Railway/Manus/MySQL fora do fluxo. Produção: **onevox-mobile-lac.vercel.app**.
- [x] Auth Supabase (login + portão + backend valida token → `ctx.user` com voice_id/role)
- [x] Rotas de voz/IA exigem sessão; voz derivada do perfil (nunca do payload)
- [x] Medição de uso → Supabase `uso` (MySQL/Drizzle aposentado)
- [x] Host serverless na Vercel (rewrite /api) + env vars (Prod) + validado (login + **falar OK**)
- [x] Limpeza camada 1 — removido Manus backend (sdk/oauth) + MySQL/Drizzle (db/schema/config/deps)
- [x] Limpeza camada 2 (parcial) — removidos use-auth/oauth-callback/api.ts órfãos
- [x] Branch de migração apagada (só `main`)

### Pendências
- [ ] Você (painéis): deletar projeto Vercel antigo → renomear o nosso p/ domínio limpo (tirar `-lac`); desligar Railway; arquivar/apagar repos antigos (oneai05, cassianopb)
- [ ] Clonar vozes no ElevenLabs e preencher `perfis.elevenlabs_voice_id` de cada usuário
- [ ] Limpeza camada 3 (quando der pra rodar `pnpm check`): restos Manus acoplados a runtime — `lib/_core/auth.ts` (usado pelo onevox-store) + partes Manus de `constants/oauth.ts` + `manus-runtime` (safe-area do _layout)
- [ ] (Futuro) Redesign visual do app (skill /redesign-app)

## Base / Design System
- [x] Configurar tema (cores OneAI: fundo escuro, gradiente verde/ciano) em theme.config.js
- [x] Criar componente de gradiente reutilizável (GradientButton / GradientBorder / GradientText)
- [x] Configurar tab bar com 4 abas (Teclado, Gravar, Frases, Perfil) e ícones
- [x] Gerar e aplicar logo do app (icon, splash, favicon, android)
- [x] Atualizar app.config.ts (appName, logoUrl)

## Aba Teclado
- [x] Layout: cabeçalho OneVox, área de texto grande, botão One AI central, ações rápidas
- [x] Botão One AI gera áudio via ElevenLabs (voz clonada) e reproduz
- [x] Botões Sim / Não falam imediatamente
- [x] Botões Limpar / Desfazer funcionam
- [x] Opção de interpretar/reescrever texto com IA antes de falar

## Aba Gravar
- [x] Estado inicial (microfone + instrução)
- [x] Estado gravando (tempo + parar)
- [x] Captura de áudio (expo-audio recording)
- [x] Upload do áudio + transcrição (Whisper)
- [x] Interpretação/reescrita com IA (mensagem clara)
- [x] Estado resultado (fala original + mensagem clara + reproduzir)
- [x] Reproduzir com voz clonada (ElevenLabs)
- [x] Ações: Gravar novamente, Falar original

## Aba Frases
- [x] Categorias (Saúde, Necessidades, Social, Emergência)
- [x] Lista de cards de frases com ícone
- [x] Tocar card fala a frase com voz clonada
- [x] Persistência local de frases (AsyncStorage) + adicionar/remover

## Aba Perfil
- [x] Cabeçalho / wordmark
- [x] Card Minha Voz Clonada (status ativo + testar + trocar voz)
- [x] Opções: Reescrita automática (IA), Acessibilidade, Histórico, Sobre
- [x] Ajustes de acessibilidade (tamanho de fonte)

## Backend / Integrações
- [x] tRPC: rota generateSpeech (ElevenLabs TTS com voiceId)
- [x] tRPC: rota transcribe (Whisper) + interpret (LLM)
- [x] Validar credencial ElevenLabs (voz clonada funcionando apos upgrade Starter)
- [x] Armazenar voiceId por usuário (Roberto Dias: GMafEIaeEWpGsrYrVqCX) via store
- [x] Store de configuracoes/historico/frases (AsyncStorage)
- [x] Hook central de fala (use-speech)

## Qualidade
- [x] Testes vitest das rotas ElevenLabs
- [x] Teste vitest da interpretacao com IA (reescrita)
- [x] Verificar status / sem erros TS
- [x] Checkpoint inicial

## Ajustes (rodada 2)
- [x] Adicionar logo da OneAI no cabecalho + texto "Mobile" proximo ao OneVox (em todas as abas)
- [x] Perfil: remover lista de outras vozes; mostrar apenas a voz clonada do usuario
- [x] Otimizar prompt da IA para reescrita mais fiel a intencao (erros graves de digitacao)
- [x] Usar logo da OneAI como icone do app (icon/splash/favicon/android) e centro do QR
