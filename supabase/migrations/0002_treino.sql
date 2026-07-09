-- OneVox - Aba Treino (coleta de audio para pesquisa/treino de modelos).
-- Adiciona: consentimento de treino no perfil, catalogo de frases curadas
-- (balanceado foneticamente para o PT-BR) e as gravacoes vinculadas a cada frase.
-- Aplicar no Supabase (SQL editor ou `supabase db push`). Idempotente.
-- OBS: o campo `texto` e o rotulo alvo lido pelo paciente -> mantido em PT-BR
-- correto (com acentos). Metadados internos (grupo/foco) ficam em ASCII.

-- ============ consentimento de treino (voz e dado biometrico) ============
alter table public.perfis
  add column if not exists treino_consent_versao text,
  add column if not exists treino_consent_em     timestamptz;

-- ============ catalogo de frases curadas ============
-- Curado pela equipe; ~100 frases cobrindo o inventario fonemico do PT-BR.
-- `texto` e o rotulo alvo; `grupo`/`foco` documentam o objetivo fonetico.
create table if not exists public.frases_treino (
  id          bigint generated always as identity primary key,
  codigo      text unique not null,        -- estavel (T001..), usado no export
  texto       text not null,               -- a frase que o paciente le em voz alta
  grupo       text not null,               -- grupo fonetico (ver seed)
  foco        text,                         -- o que a frase exercita
  dificuldade smallint not null default 1, -- 1=curta/facil, 2=media, 3=longa
  ordem       integer not null default 0,  -- ordem de apresentacao
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
create index if not exists frases_treino_ordem_idx on public.frases_treino (ordem);

-- ============ gravacoes (1 linha por take, todas guardadas) ============
-- Vinculo audio <-> frase e o coracao do dataset: frase_id (FK) + texto_snapshot
-- (o texto exato mostrado na hora, para o rotulo nao "escorregar" se a frase for
-- editada depois). Metadados so tecnicos (sem dado de saude).
create table if not exists public.gravacoes_treino (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,  -- falante
  frase_id       bigint not null references public.frases_treino(id),
  frase_codigo   text,                       -- denormalizado p/ export facil
  texto_snapshot text not null,              -- rotulo real (texto no momento da gravacao)
  storage_key    text not null,              -- caminho no bucket privado
  mime_type      text,
  plataforma     text,                        -- web | ios | android
  duracao_ms     integer,
  bytes          integer,
  consent_versao text,
  status         text not null default 'ok', -- 'ok' | 'descartada'
  criado_em      timestamptz not null default now()
);
create index if not exists gravacoes_treino_user_idx  on public.gravacoes_treino (user_id, frase_id);
create index if not exists gravacoes_treino_frase_idx on public.gravacoes_treino (frase_id);

-- ============ RLS ============
-- Todo acesso do servidor usa service_role (ignora RLS); as policies abaixo sao
-- defesa em profundidade caso algum dia o cliente leia direto com a anon key.
alter table public.frases_treino     enable row level security;
alter table public.gravacoes_treino  enable row level security;

-- frases: qualquer usuario autenticado le o catalogo ativo
drop policy if exists "frases_treino_select_auth" on public.frases_treino;
create policy "frases_treino_select_auth" on public.frases_treino
  for select using (auth.role() = 'authenticated');

-- gravacoes: cada usuario le apenas as proprias (escrita e feita pelo backend)
drop policy if exists "gravacoes_treino_select_own" on public.gravacoes_treino;
create policy "gravacoes_treino_select_own" on public.gravacoes_treino
  for select using (auth.uid() = user_id);

-- ============ seed do catalogo (corpus foneticamente balanceado) ============
insert into public.frases_treino (codigo, texto, grupo, foco, dificuldade, ordem) values
-- G1. Vogais orais (a, e/E, i, o/O, u; contrastes aberto/fechado)
('T001','Ana ama a cama.','VOG_ORAL','Vogal /a/ tonica e atona',1,1),
('T002','O café é amargo.','VOG_ORAL','Vogal aberta /E/',1,2),
('T003','Ele bebe o leite.','VOG_ORAL','Vogal fechada /e/ e ditongo ei',1,3),
('T004','Vi o livro ali.','VOG_ORAL','Vogal /i/',1,4),
('T005','A porta está aberta.','VOG_ORAL','Vogal aberta /O/',1,5),
('T006','Vovô comprou o bolo.','VOG_ORAL','Vogal fechada /o/ e /u/',2,6),
('T007','A uva é bem doce.','VOG_ORAL','Vogal /u/',1,7),
('T008','A avó e o avô saíram.','VOG_ORAL','Contraste /O/ x /o/ (avo x avo)',2,8),
-- G2. Vogais e ditongos nasais
('T009','A manhã está fria.','VOG_NASAL','Vogal nasal /a~/',1,9),
('T010','Comprei pão e maçã.','VOG_NASAL','Ditongo nasal ao e /a~/',1,10),
('T011','Minha mãe fez um pão.','VOG_NASAL','Ditongos nasais ae e ao',2,11),
('T012','O cão late no portão.','VOG_NASAL','Ditongo nasal ao repetido',2,12),
('T013','Ele põe as mãos na mesa.','VOG_NASAL','Ditongos nasais oe e ao',2,13),
('T014','Eu tenho cem reais.','VOG_NASAL','Vogal nasal /e~/',1,14),
('T015','A ponte é bem longa.','VOG_NASAL','Vogal nasal /o~/',1,15),
('T016','Bom dia, dona Antônia.','VOG_NASAL','Nasalidade em contexto',2,16),
-- G3. Plosivas (contraste de vozeamento p/b, t/d, k/g)
('T017','O pato nada no lago.','PLOSIVAS','Surdas p, t e sonora g',1,17),
('T018','A bola bateu na trave.','PLOSIVAS','Sonora b e surda t',1,18),
('T019','O tio deu um doce.','PLOSIVAS','Contraste t x d',1,19),
('T020','A capa do caderno.','PLOSIVAS','Surda k e sonora d',1,20),
('T021','O gato caçou o rato.','PLOSIVAS','Contraste g x k',1,21),
('T022','Papai comprou pipoca.','PLOSIVAS','Surda p em varias silabas',1,22),
('T023','O dedo do bebê doeu.','PLOSIVAS','Sonoras d e b',2,23),
('T024','Tomate, batata e beterraba.','PLOSIVAS','Alternancia t/b e vibrante rr',3,24),
-- G4. Fricativas (f/v, s/z, x(S)/j(Z))
('T025','O sapo saltou na lagoa.','FRICATIVAS','Fricativa surda /s/',1,25),
('T026','A casa é bem azul.','FRICATIVAS','Fricativa sonora /z/',1,26),
('T027','O chá está quente.','FRICATIVAS','Fricativa /S/ (ch)',1,27),
('T028','A janela ficou aberta.','FRICATIVAS','Fricativa /Z/ (j)',1,28),
('T029','A faca corta o pão.','FRICATIVAS','Fricativa surda /f/',1,29),
('T030','A vaca vive no campo.','FRICATIVAS','Fricativa sonora /v/',1,30),
('T031','A zebra e a girafa.','FRICATIVAS','/z/, /Z/ e /f/ juntos',2,31),
('T032','O peixe fresco no gelo.','FRICATIVAS','/S/, /f/ e /Z/',2,32),
-- G5. Consoantes nasais (m, n, nh)
('T033','A menina come maçã.','NASAIS','Nasais m e n',1,33),
('T034','O ninho do passarinho.','NASAIS','Nasal palatal /J/ (nh)',2,34),
('T035','Amanhã vou tomar banho.','NASAIS','Nasal palatal /J/ (nh)',2,35),
('T036','A montanha é bonita.','NASAIS','Nasal /J/ e /n/',2,36),
('T037','Nove meninos na sala.','NASAIS','Nasais n e m',1,37),
('T038','O sino toca de manhã.','NASAIS','Nasais n e /J/',1,38),
('T039','Uma dama numa cama.','NASAIS','Nasal /m/ recorrente',1,39),
('T040','O homem tem um sonho.','NASAIS','Nasalidade e /J/ (sonho)',2,40),
-- G6. Laterais (l, lh, l em coda)
('T041','O lápis caiu no chão.','LATERAIS','Lateral /l/',1,41),
('T042','A bola rolou pelo chão.','LATERAIS','/l/ intervocalico',2,42),
('T043','A filha dela é linda.','LATERAIS','Lateral palatal /L/ (lh)',1,43),
('T044','O joelho dele dói.','LATERAIS','Lateral palatal /L/ (lh)',1,44),
('T045','O sol brilha no céu.','LATERAIS','L em coda ([w]) e /L/',2,45),
('T046','A folha caiu da árvore.','LATERAIS','/L/ (lh) e rotico',2,46),
('T047','Aquele animal é calmo.','LATERAIS','L em coda',2,47),
('T048','Ele tem mil reais.','LATERAIS','L em coda final',1,48),
-- G7. Roticos (tap /r/, forte /R/, r em coda)
('T049','O rato correu rápido.','ROTICOS','R forte inicial e vibrante',1,49),
('T050','Maria preparou o almoço.','ROTICOS','Tap /r/ e encontro pr',2,50),
('T051','O carro é vermelho.','ROTICOS','R forte (rr) e /L/',1,51),
('T052','O rio corre para o mar.','ROTICOS','R forte, tap e r em coda',2,52),
('T053','A porta rangeu forte.','ROTICOS','R em coda e /Z/',2,53),
('T054','Corri até o portão.','ROTICOS','R forte e r em coda',1,54),
('T055','São três horas da tarde.','ROTICOS','Encontro tr e r em coda',1,55),
('T056','A terra é bem fértil.','ROTICOS','R forte (rr) e r em coda',2,56),
-- G8. Palatalizacao e africadas (ti/di -> tS/dZ, ch, j)
('T057','O tio dirige o carro.','PALATAIS','Africadas tS (tio) e dZ (dirige)',2,57),
('T058','O time ganhou de novo.','PALATAIS','Africada tS (time)',1,58),
('T059','A tia disse a verdade.','PALATAIS','Africadas tS e dZ',2,59),
('T060','O dia está bonito.','PALATAIS','Africada dZ (dia)',1,60),
('T061','O chinelo é dele.','PALATAIS','Fricativa /S/ (ch)',1,61),
('T062','Vinte e cinco dias.','PALATAIS','Africadas tS e dZ em numeros',2,62),
('T063','O dente dele doeu.','PALATAIS','Africada dZ final (dente)',1,63),
('T064','O jipe subiu a ladeira.','PALATAIS','Fricativa /Z/ (jipe)',2,64),
-- G9. Encontros consonantais
('T065','O prato está na mesa.','CLUSTERS','Encontro pr',1,65),
('T066','A bruxa perdeu a vassoura.','CLUSTERS','Encontro br',1,66),
('T067','O trem chegou atrasado.','CLUSTERS','Encontro tr',1,67),
('T068','O dragão cuspiu fogo.','CLUSTERS','Encontro dr',1,68),
('T069','A cruz é dourada.','CLUSTERS','Encontro cr',1,69),
('T070','O globo mostra o grande mundo.','CLUSTERS','Encontros gl e gr',2,70),
('T071','A fruta fresca é boa.','CLUSTERS','Encontro fr',1,71),
('T072','A flor da planta é branca.','CLUSTERS','Encontros fl, pl e br',2,72),
('T073','O bloco caiu no chão.','CLUSTERS','Encontro bl',1,73),
('T074','A classe toda aplaudiu.','CLUSTERS','Encontro cl e pl (aplaudiu)',2,74),
-- G10. Ditongos orais
('T075','O pai saiu cedo.','DITONGOS','Ditongo ai',1,75),
('T076','A lei foi aprovada.','DITONGOS','Ditongos ei e oi',1,76),
('T077','O boi está no pasto.','DITONGOS','Ditongo oi',1,77),
('T078','Eu sei a resposta.','DITONGOS','Ditongo ei',1,78),
('T079','O céu está azul.','DITONGOS','Ditongo eu (aberto)',1,79),
('T080','O chapéu é novo.','DITONGOS','Ditongo eu',1,80),
('T081','O anel é de ouro.','DITONGOS','Ditongo ou',1,81),
('T082','Ele viu o mar hoje.','DITONGOS','Ditongo iu',1,82),
-- G11. Codas e plurais (s, r, l)
('T083','As casas são grandes.','CODAS','Coda /s/ em plural',1,83),
('T084','Os pastéis estão prontos.','CODAS','Coda /s/ e ditongo ei',2,84),
('T085','Dois pastores no campo.','CODAS','Coda /s/ e r em coda',1,85),
('T086','As flores são lindas.','CODAS','Coda /s/ em plural',1,86),
('T087','Estas festas são boas.','CODAS','Cluster st e coda /s/',2,87),
('T088','Os meninos brincam juntos.','CODAS','Coda /s/ recorrente',2,88),
('T089','Três vestidos azuis.','CODAS','Coda /s/ em varias palavras',2,89),
('T090','As luzes se apagaram.','CODAS','Coda /z/ (luzes)',2,90),
-- G12. Frases funcionais e prosodia (pergunta, exclamacao, numeros, dia a dia)
('T091','Bom dia, tudo bem?','FUNCIONAL','Prosodia interrogativa; uso diario',1,91),
('T092','Estou com fome.','FUNCIONAL','Frase funcional curta',1,92),
('T093','Preciso de ajuda, por favor.','FUNCIONAL','Pedido; uso diario',2,93),
('T094','Que horas são?','FUNCIONAL','Prosodia interrogativa',1,94),
('T095','Muito obrigado!','FUNCIONAL','Prosodia exclamativa',1,95),
('T096','Estou com sede agora.','FUNCIONAL','Frase funcional',1,96),
('T097','Onde fica o banheiro?','FUNCIONAL','Pergunta; uso diario',2,97),
('T098','Hoje é segunda-feira.','FUNCIONAL','Frase declarativa; dias',1,98),
('T099','São três e meia da tarde.','FUNCIONAL','Numeros e horas',2,99),
('T100','Estou me sentindo bem melhor hoje.','FUNCIONAL','Frase mais longa; prosodia',2,100)
on conflict (codigo) do nothing;
