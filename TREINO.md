# Aba Treino — coleta de audio para pesquisa

## Objetivo
Coletar amostras de fala dos pacientes, **rotuladas por frase**, para treinar e
avaliar modelos que entendem/transcrevem melhor a fala com dificuldade (disartria).
Cada audio fica vinculado a frase exata que foi lida. Ferramenta de pesquisa, com
consentimento explicito do paciente.

## Fluxo do usuario
1. **Consentimento** (1a vez): termo curto; voz e dado pessoal sensivel. Registrado
   em `perfis.treino_consent_versao` / `treino_consent_em`.
2. **Resumo/progresso**: "X / N frases gravadas" + botao Comecar/Continuar.
3. **Sessao guiada** (1 frase por vez): le a frase em voz alta -> grava -> **ouve o
   proprio take** para conferir -> Regravar ou Confirmar e proxima. Rapido, no ritmo do usuario.

O usuario NAO navega nos audios antigos; o objetivo e produzir takes, nao gerenciar biblioteca.

## Modelo de dados (migration `supabase/migrations/0002_treino.sql`)
- `frases_treino`: catalogo curado (~100 frases). `texto` = rotulo alvo; `grupo`/`foco`
  = objetivo fonetico; `dificuldade`, `ordem`, `ativo`.
- `gravacoes_treino`: 1 linha por take. Vinculo audio<->frase = `frase_id` (FK) +
  **`texto_snapshot`** (texto no momento da gravacao, para o rotulo nao "escorregar"
  se a frase for editada depois). Metadados so tecnicos: `mime_type`, `plataforma`,
  `duracao_ms`, `bytes`, `consent_versao`. Sem dado de saude.
- Audio no **bucket privado** do Supabase, caminho `treino/<user_id>/<frase_id>/<ts>.<ext>`.
- RLS: usuario le so as proprias linhas; catalogo legivel por autenticados; escrita
  sempre pelo backend (service_role).

## Rotas (tRPC — `server/training.ts`)
- `training.state` — consentimento + catalogo + progresso do usuario (1 ida ao servidor).
- `training.acceptConsent` — registra o aceite do termo.
- `training.submitRecording` — sobe o audio e cria a linha (falante vem SEMPRE da sessao).
- `training.adminExport` — (admin) dataset completo + URLs assinadas para baixar/treinar.

Custo de API: **zero** (nao chama OpenAI/ElevenLabs; so grava e guarda).

## Corpus foneticamente balanceado (racional)
Principios usados na curadoria das 100 frases:
1. **Cobertura do inventario fonemico do PT-BR**: todos os fonemas aparecem varias vezes.
2. **Contrastes que a disartria mais compromete**: vozeamento (p/b, t/d, k/g, f/v, s/z),
   ponto de articulacao (m/n), liquidas (l, r, lh, nh), oral x nasal.
3. **Gradiente de dificuldade** (`dificuldade` 1->3): comeca curto para reduzir fadiga.
4. **Frases curtas** (maioria 3-7 palavras): producao em uma expiracao, interacao rapida.
5. **Prosodia variada**: declarativa, interrogativa, exclamativa, numeros/horas.
6. **Relevancia comunicativa**: parte das frases e util no dia a dia (motivacao + validade).
7. **Posicao silabica**: fonemas em ataque, meio e coda (ex.: /s/ inicial, medial e em coda).

Os 12 grupos (`grupo`): `VOG_ORAL`, `VOG_NASAL`, `PLOSIVAS`, `FRICATIVAS`, `NASAIS`,
`LATERAIS`, `ROTICOS`, `PALATAIS` (ti/di, ch, j), `CLUSTERS` (encontros consonantais),
`DITONGOS`, `CODAS` (s/r/l finais e plurais), `FUNCIONAL` (dia a dia + prosodia).

### Curar/editar o corpus
Editar `frases_treino` (add/altera/`ativo=false`). Nao reeditar o texto de uma frase
ja gravada sem trocar o `codigo` — o `texto_snapshot` das gravacoes antigas preserva o
rotulo original, mas manter `codigo` estavel evita confusao no export.

## Como colocar de pe
1. Aplicar a migration no Supabase: `supabase db push` (ou rodar o SQL no editor).
2. Deploy da branch na Vercel (bucket de storage ja configurado via `SUPABASE_STORAGE_BUCKET`).
3. Admin do export: e-mail em `ADMIN_EMAILS` (env do backend).

## Export para treino
`training.adminExport` devolve as linhas + URLs assinadas. Normalizar os audios para
**16 kHz mono WAV** no passo de export (web grava webm/opus, nativo grava m4a/aac) —
a coleta guarda o original + `mime_type`/`plataforma` para permitir isso depois.
