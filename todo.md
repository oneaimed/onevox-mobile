# OneVox Mobile — TODO

## Migração para Supabase serverless (em andamento — branch feat/migracao-supabase-serverless)
Alvo: Vercel serverless + Supabase (Auth + Postgres + Storage). Dropar Railway, Manus e MySQL.
- [x] Etapa 1 — fundação Supabase (clientes front/back, schema perfis/uso, .env.example)
- [x] Etapa 2a — auth frontend (tela de login + portão)
- [x] Proteger `.env` no .gitignore
- [ ] Setup Supabase (você): ligar Auth email/senha + rodar `supabase/migrations/0001_init.sql` + criar contas com `elevenlabs_voice_id` + chaves no `.env`/Vercel
- [ ] `pnpm install` (sincronizar pnpm-lock após incluir @supabase/supabase-js)
- [ ] Etapa 2b — backend valida token Supabase (ctx.user) + logout no Perfil + voice_id do perfil
- [ ] Etapa 3 — medição de uso → Supabase Postgres (aposentar versão MySQL)
- [ ] Etapa 4 — host serverless na Vercel + remover Manus, MySQL/Drizzle e Railway

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
