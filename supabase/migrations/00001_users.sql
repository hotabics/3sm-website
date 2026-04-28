-- Fāze 1: users tabula + RLS + auto-profile trigger.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text,
  phone text,
  whatsapp text,
  avatar_url text,
  role text not null default 'player' check (role in ('player', 'admin')),
  player_type text not null default 'reserve' check (player_type in ('core', 'reserve')),
  fixed_team text check (fixed_team in ('black', 'white', 'flexible')),
  email_alias text unique,
  email_alias_active boolean default false,
  email_alias_expires_at timestamptz,
  semester_paid_until date,
  created_at timestamptz default now()
);

alter table public.users enable row level security;

-- Visi autentificētie var redzēt publisko info par citiem (saraksts utt).
drop policy if exists "users_select_all" on public.users;
create policy "users_select_all"
  on public.users
  for select
  to authenticated
  using (true);

-- Lietotājs var rediģēt tikai savu rindu.
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
  on public.users
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Lietotājs var ievietot tikai savu rindu (onboarding upsert).
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
  on public.users
  for insert
  to authenticated
  with check (auth.uid() = id);

-- Admin var visu (atsevišķa policy ar role pārbaudi).
drop policy if exists "users_admin_all" on public.users;
create policy "users_admin_all"
  on public.users
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Auto-izveido tukšu profilu, kad signup notiek caur Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
