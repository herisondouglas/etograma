-- =====================================================================
-- Etograma: banco de dados no Supabase
-- Como usar: Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
-- Pode rodar de novo sem perder dados (só cria o que ainda não existe e
-- recria funções, gatilhos, regras de acesso e visões).
--
-- Ideia geral
-- • O app continua salvando primeiro no celular (funciona sem internet no curral)
--   e sincroniza com estas tabelas quando há conexão.
-- • Cada pessoa entra com e-mail e senha. Quem cria um experimento vira
--   "responsavel"; os observadores entram nele com o código de convite.
-- • Ninguém vê experimentos dos quais não participa (Row Level Security).
-- • Nada é apagado de verdade pelo app: linhas apagadas ficam com deleted = true
--   para que a exclusão chegue aos outros aparelhos.
-- =====================================================================

-- ---------- tabelas ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  created_at timestamptz not null default now()
);

create table if not exists public.experiments (
  id          text primary key,
  owner       uuid not null default auth.uid() references auth.users(id),
  nome        text not null,
  especie_id  text,
  especie     text,
  responsavel text,
  inicio      date,
  rotulo      text not null default 'Baia' check (rotulo in ('Baia','Animal')),
  codigo      text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  deleted     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.experiment_members (
  experiment_id text not null references public.experiments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  papel         text not null default 'observador' check (papel in ('responsavel','observador')),
  created_at    timestamptz not null default now(),
  primary key (experiment_id, user_id)
);

-- tratamentos (dietas)
create table if not exists public.treatments (
  id            text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  nome          text not null,
  dieta         text,
  gmd_meta      numeric,
  cor           text,
  ordem         int not null default 0,
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- animais (um por baia)
create table if not exists public.animals (
  id            text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  treatment_id  text,
  baia          text,
  brinco        text,
  raca          text,
  sexo          text,
  nascimento    date,
  obs           text,
  saida         jsonb,          -- { "data": "AAAA-MM-DD", "motivo": "...", "obs": "..." } quando saiu do experimento
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- pesagens: uma linha por data; pesos = { "<id do animal>": kg }
create table if not exists public.weighings (
  id            text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  data          date not null,
  pesos         jsonb not null default '{}',
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- consumo: uma linha por data; valores = { "<id do animal>": kg MS/dia }
create table if not exists public.intakes (
  id            text primary key,
  experiment_id text not null references public.experiments(id) on delete cascade,
  data          date not null,
  valores       jsonb not null default '{}',
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

-- observações (etograma de um observador). Avulsas têm experiment_id nulo e só o dono vê.
create table if not exists public.sessions (
  id            text primary key,
  experiment_id text references public.experiments(id) on delete cascade,
  owner         uuid not null default auth.uid() references auth.users(id),
  nome          text,
  especie       text,
  observador    text,
  comp          jsonb not null default '[]',   -- cópia do etograma: [{id, nome, tipo}]
  animais       jsonb not null default '[]',   -- nomes mostrados: ["Baia 1", ...]
  animal_ids    jsonb,                         -- ids dos animais: ["a1", ...]
  inicio        bigint not null,               -- início em milissegundos (Date.now())
  intervalo     int not null,                  -- minutos entre marcações
  duracao       numeric not null,              -- horas
  marks         jsonb not null default '{}',   -- { "<índice do animal>": { "<horário>": ["<id do comportamento>", ...] } }
  obs           jsonb not null default '{}',   -- { "<índice do animal>": { "<horário>": "texto" } }
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

create index if not exists treatments_exp on public.treatments(experiment_id, updated_at);
create index if not exists animals_exp    on public.animals(experiment_id, updated_at);
create index if not exists weighings_exp  on public.weighings(experiment_id, updated_at);
create index if not exists intakes_exp    on public.intakes(experiment_id, updated_at);
create index if not exists sessions_exp   on public.sessions(experiment_id, updated_at);
create index if not exists sessions_owner on public.sessions(owner);
create index if not exists members_user   on public.experiment_members(user_id);

-- ---------- funções auxiliares ----------
-- updated_at sempre com a hora do servidor (o app usa isso para buscar só o que mudou)
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at := clock_timestamp(); return new; end $$;

create or replace function public.is_member(exp text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from experiment_members where experiment_id = exp and user_id = auth.uid())
$$;

create or replace function public.is_responsavel(exp text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from experiment_members where experiment_id = exp and user_id = auth.uid() and papel = 'responsavel')
$$;

-- quem cria o experimento vira responsável automaticamente
create or replace function public.add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into experiment_members(experiment_id, user_id, papel) values (new.id, new.owner, 'responsavel')
  on conflict do nothing;
  return new;
end $$;

-- dono e código não mudam; só o responsável apaga o experimento
create or replace function public.guard_experiment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.owner  := old.owner;
  new.codigo := old.codigo;
  if new.deleted and not old.deleted and not is_responsavel(old.id) then
    raise exception 'Só o responsável pode apagar o experimento';
  end if;
  return new;
end $$;

-- a observação continua sendo de quem criou
create or replace function public.guard_session() returns trigger
language plpgsql as $$
begin new.owner := old.owner; return new; end $$;

-- perfil criado junto com a conta (nome vem do cadastro no app)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, nome) values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

-- entrar num experimento com o código de convite
create or replace function public.join_experiment(p_codigo text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro'; end if;
  select id into v_id from experiments where codigo = upper(trim(p_codigo)) and not deleted;
  if v_id is null then raise exception 'Código não encontrado'; end if;
  insert into experiment_members(experiment_id, user_id, papel) values (v_id, auth.uid(), 'observador')
  on conflict do nothing;
  return v_id;
end $$;

-- ---------- gatilhos ----------
do $$
declare t text;
begin
  foreach t in array array['experiments','treatments','animals','weighings','intakes','sessions'] loop
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format('create trigger %1$s_touch before insert or update on public.%1$s for each row execute function public.touch()', t);
  end loop;
end $$;

drop trigger if exists experiments_owner on public.experiments;
create trigger experiments_owner after insert on public.experiments for each row execute function public.add_owner_member();
drop trigger if exists experiments_guard on public.experiments;
create trigger experiments_guard before update on public.experiments for each row execute function public.guard_experiment();
drop trigger if exists sessions_guard on public.sessions;
create trigger sessions_guard before update on public.sessions for each row execute function public.guard_session();
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- segurança (Row Level Security) ----------
alter table public.profiles           enable row level security;
alter table public.experiments        enable row level security;
alter table public.experiment_members enable row level security;
alter table public.treatments         enable row level security;
alter table public.animals            enable row level security;
alter table public.weighings          enable row level security;
alter table public.intakes            enable row level security;
alter table public.sessions           enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from experiment_members a join experiment_members b using (experiment_id)
    where a.user_id = auth.uid() and b.user_id = profiles.id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists experiments_select on public.experiments;
create policy experiments_select on public.experiments for select to authenticated using (owner = auth.uid() or is_member(id));
drop policy if exists experiments_insert on public.experiments;
create policy experiments_insert on public.experiments for insert to authenticated with check (owner = auth.uid());
drop policy if exists experiments_update on public.experiments;
create policy experiments_update on public.experiments for update to authenticated using (is_member(id)) with check (is_member(id));

drop policy if exists members_select on public.experiment_members;
create policy members_select on public.experiment_members for select to authenticated using (user_id = auth.uid() or is_member(experiment_id));
drop policy if exists members_delete on public.experiment_members;
create policy members_delete on public.experiment_members for delete to authenticated using (user_id = auth.uid() or is_responsavel(experiment_id));
-- (entrar só pelo código: join_experiment; não há insert direto)

do $$
declare t text;
begin
  foreach t in array array['treatments','animals','weighings','intakes'] loop
    execute format('drop policy if exists %1$s_all on public.%1$s', t);
    execute format('create policy %1$s_all on public.%1$s for all to authenticated using (is_member(experiment_id)) with check (is_member(experiment_id))', t);
  end loop;
end $$;

drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated
  using (owner = auth.uid() or (experiment_id is not null and is_member(experiment_id)));
drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions for insert to authenticated
  with check (owner = auth.uid() and (experiment_id is null or is_member(experiment_id)));
drop policy if exists sessions_update on public.sessions;
create policy sessions_update on public.sessions for update to authenticated
  using (owner = auth.uid() or (experiment_id is not null and is_member(experiment_id)))
  with check (experiment_id is null and owner = auth.uid() or experiment_id is not null and is_member(experiment_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.experiments, public.experiment_members, public.treatments,
  public.animals, public.weighings, public.intakes, public.sessions to authenticated;
grant select, update on public.profiles to authenticated;
revoke all on function public.join_experiment(text) from public;
grant execute on function public.join_experiment(text) to authenticated;

-- ---------- tempo real (outros celulares recebem as mudanças na hora) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['experiments','experiment_members','treatments','animals','weighings','intakes','sessions'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ---------- visões para análise (R, SAS, planilha) ----------
-- Formato "longo": uma linha por medida. Respeitam as permissões de quem consulta.
create or replace view public.vw_animais with (security_invoker = on) as
select e.id as experimento_id, e.nome as experimento, e.especie, a.id as animal_id, a.baia, a.brinco,
       t.nome as tratamento, a.raca, a.sexo, a.nascimento,
       (a.saida is null) as ativo, (a.saida->>'data')::date as saida_data, a.saida->>'motivo' as saida_motivo
from public.animals a
join public.experiments e on e.id = a.experiment_id
left join public.treatments t on t.id = a.treatment_id
where not a.deleted and not e.deleted;

create or replace view public.vw_pesagens with (security_invoker = on) as
select e.id as experimento_id, e.nome as experimento, a.id as animal_id, a.baia, a.brinco, t.nome as tratamento,
       w.data, (kv.value)::numeric as peso_kg, (a.saida is null) as ativo
from public.weighings w
join public.experiments e on e.id = w.experiment_id
cross join lateral jsonb_each_text(w.pesos) kv
join public.animals a on a.id = kv.key
left join public.treatments t on t.id = a.treatment_id
where not w.deleted and not e.deleted and not a.deleted;

create or replace view public.vw_consumo with (security_invoker = on) as
select e.id as experimento_id, e.nome as experimento, a.id as animal_id, a.baia, a.brinco, t.nome as tratamento,
       i.data, (kv.value)::numeric as cms_kg_dia, (a.saida is null) as ativo
from public.intakes i
join public.experiments e on e.id = i.experiment_id
cross join lateral jsonb_each_text(i.valores) kv
join public.animals a on a.id = kv.key
left join public.treatments t on t.id = a.treatment_id
where not i.deleted and not e.deleted and not a.deleted;

-- uma linha por marcação (X) da planilha do etograma
create or replace view public.vw_marcacoes with (security_invoker = on) as
select s.experiment_id as experimento_id, s.id as observacao_id, s.observador,
       s.animais->>(ai.key::int) as animal, s.animal_ids->>(ai.key::int) as animal_id,
       to_timestamp((s.inicio + sl.key::bigint * s.intervalo * 60000) / 1000.0) as horario,
       s.intervalo as intervalo_min, c->>'nome' as comportamento, c->>'tipo' as tipo
from public.sessions s
cross join lateral jsonb_each(s.marks) ai
cross join lateral jsonb_each(ai.value) sl
cross join lateral jsonb_array_elements_text(sl.value) cid
join lateral (select x from jsonb_array_elements(s.comp) x where x->>'id' = cid) cc(c) on true
where not s.deleted;

grant select on public.vw_animais, public.vw_pesagens, public.vw_consumo, public.vw_marcacoes to authenticated;
