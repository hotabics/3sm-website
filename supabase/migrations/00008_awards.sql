-- Fāze 6.1: treniņa apbalvojumi.
-- - mvp_black / mvp_white — pa vienam katras komandas labākajam spēlētājam
-- - custom — brīvas formas teksts (piemēram "Treniņa pārsteigums",
--   "Labākais vārtsargs"), drīkst būt vairāki

create table if not exists public.match_awards (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  award_type text not null check (award_type in ('mvp_black', 'mvp_white', 'custom')),
  label text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);

create index if not exists match_awards_training_idx
  on public.match_awards (training_id);
create index if not exists match_awards_user_idx
  on public.match_awards (user_id);

-- MVP — viens katras komandas titulam vienā treniņā.
create unique index if not exists match_awards_mvp_unique
  on public.match_awards (training_id, award_type)
  where award_type in ('mvp_black', 'mvp_white');

alter table public.match_awards enable row level security;

drop policy if exists "match_awards_select_public" on public.match_awards;
create policy "match_awards_select_public"
  on public.match_awards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "match_awards_admin_all" on public.match_awards;
create policy "match_awards_admin_all"
  on public.match_awards
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
