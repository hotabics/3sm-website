-- Fāze 3: rezultāti + paziņojumu audit log.

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade unique,
  black_score int not null check (black_score >= 0),
  white_score int not null check (white_score >= 0),
  submitted_by uuid not null references public.users(id),
  approved_by uuid references public.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz default now(),
  approved_at timestamptz
);

create index if not exists results_status_idx on public.results (status);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  type text not null,
  channel text not null check (channel in ('whatsapp_group', 'whatsapp_personal', 'email')),
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);

alter table public.results enable row level security;
alter table public.notifications enable row level security;

-- ============ results policies ============

-- Visi autentificētie var lasīt apstiprinātos rezultātus.
drop policy if exists "results_select_approved" on public.results;
create policy "results_select_approved"
  on public.results
  for select
  to authenticated
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or public.is_admin()
  );

-- Jebkurš autentificēts dalībnieks var iesniegt rezultātu treniņam, kurā piedalījies.
drop policy if exists "results_insert_participant" on public.results;
create policy "results_insert_participant"
  on public.results
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.registrations r
      where r.training_id = results.training_id
        and r.user_id = auth.uid()
        and r.status = 'confirmed'
    )
  );

-- Tikai admins var apstiprināt vai labot.
drop policy if exists "results_admin_update" on public.results;
create policy "results_admin_update"
  on public.results
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============ notifications policies ============

drop policy if exists "notifications_admin_only" on public.notifications;
create policy "notifications_admin_only"
  on public.notifications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
