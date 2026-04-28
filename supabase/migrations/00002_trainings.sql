-- Fāze 2: treniņi + reģistrācijas + RLS.

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  start_time time not null default '20:00',
  end_time time not null default '21:30',
  location text default 'Pilna info admin panelī',
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled', 'completed')),
  min_players int not null default 10,
  max_players int not null default 14,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  created_at timestamptz default now()
);

create index if not exists trainings_date_idx on public.trainings (date desc);
create index if not exists trainings_status_idx on public.trainings (status);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'queue' check (status in ('confirmed', 'queue', 'cancelled')),
  team text check (team in ('black', 'white')),
  queue_position int,
  payment_id uuid,
  registered_at timestamptz default now(),
  cancelled_at timestamptz,
  unique (training_id, user_id)
);

create index if not exists registrations_training_idx
  on public.registrations (training_id, status);
create index if not exists registrations_user_idx
  on public.registrations (user_id);

alter table public.trainings enable row level security;
alter table public.registrations enable row level security;

-- ============ trainings policies ============

drop policy if exists "trainings_select_authenticated" on public.trainings;
create policy "trainings_select_authenticated"
  on public.trainings
  for select
  to authenticated
  using (true);

drop policy if exists "trainings_admin_write" on public.trainings;
create policy "trainings_admin_write"
  on public.trainings
  for all
  to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );

-- ============ registrations policies ============

-- Visi autentificētie var redzēt visas reģistrācijas (lai redz, kas piesakās).
drop policy if exists "registrations_select_authenticated" on public.registrations;
create policy "registrations_select_authenticated"
  on public.registrations
  for select
  to authenticated
  using (true);

-- Lietotājs var pievienot tikai sevi.
drop policy if exists "registrations_insert_self" on public.registrations;
create policy "registrations_insert_self"
  on public.registrations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Lietotājs var atjaunināt tikai savu rindu (atcelšanai).
drop policy if exists "registrations_update_self" on public.registrations;
create policy "registrations_update_self"
  on public.registrations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin var visu.
drop policy if exists "registrations_admin_all" on public.registrations;
create policy "registrations_admin_all"
  on public.registrations
  for all
  to authenticated
  using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  )
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
