-- Fāze 4: maksājumi (Stripe + manuālie Swedbank).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('semester', 'single_training', 'email_monthly', 'email_yearly')),
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'eur',
  provider text not null check (provider in ('stripe', 'manual_swedbank')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_subscription_id text,
  training_id uuid references public.trainings(id) on delete set null,
  period_start date,
  period_end date,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_training_idx on public.payments (training_id);
create index if not exists payments_status_idx on public.payments (status);

alter table public.payments enable row level security;

-- Lietotājs redz savus maksājumus.
drop policy if exists "payments_select_self" on public.payments;
create policy "payments_select_self"
  on public.payments
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Admin var visu.
drop policy if exists "payments_admin_all" on public.payments;
create policy "payments_admin_all"
  on public.payments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Sasaista esošo registrations.payment_id ar payments tabulu (FK trūka shēmā).
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'registrations_payment_fkey'
      and table_schema = 'public'
  ) then
    alter table public.registrations
      add constraint registrations_payment_fkey
      foreign key (payment_id) references public.payments(id)
      on delete set null;
  end if;
end$$;
