-- OneVox - schema inicial no Supabase (perfis + uso) com RLS.
-- Aplicar no projeto Supabase (SQL editor ou `supabase db push`).
-- Portado da branch cassiano (stack ja validada).

-- ============ perfis (estende auth.users) ============
create table if not exists public.perfis (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nome                text,
  elevenlabs_voice_id text,
  modo_preferido      smallint not null default 2,   -- 1=literal, 2=correcao+conferir, 3=auto
  ativo               boolean  not null default true,
  criado_em           timestamptz not null default now()
);

-- ============ uso (1 evento por chamada externa) ============
create table if not exists public.uso (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  criado_em      timestamptz not null default now(),
  provedor       text not null,            -- 'openai' | 'elevenlabs'
  operacao       text not null,            -- 'correcao' | 'tts' | 'stt'
  modo           smallint,
  tokens_in      integer,
  tokens_out     integer,
  caracteres     integer,
  segundos_audio numeric,
  custo_usd      numeric(10,6),
  latencia_ms    integer,
  sucesso        boolean not null default true,
  detalhe        jsonb
);
create index if not exists uso_user_data_idx on public.uso (user_id, criado_em);

-- ============ RLS ============
alter table public.perfis enable row level security;
alter table public.uso    enable row level security;

-- cada usuario le/edita apenas o proprio perfil
create policy "perfil_select_own" on public.perfis for select using (auth.uid() = id);
create policy "perfil_update_own" on public.perfis for update using (auth.uid() = id);

-- cada usuario le apenas o proprio uso (a escrita e feita pelo backend com service_role,
-- que ignora RLS)
create policy "uso_select_own" on public.uso for select using (auth.uid() = user_id);

-- ============ cria perfil automaticamente ao criar usuario ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome) values (new.id, new.raw_user_meta_data->>'nome')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
