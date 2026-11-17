-- Google Sheets rezervāciju integrācijas pamats.
--
-- Supabase paliek vienīgais rezervāciju patiesības avots. Google Sheets ir
-- uzticamas komandas ievades/skatījuma virsma, kuras darbības nonāk šajā
-- datubāzē kā idempotentas komandas.

create table if not exists public.google_sheet_training_maps (
  id uuid primary key default gen_random_uuid(),
  spreadsheet_id text not null,
  sheet_gid bigint not null,
  sheet_name text not null,
  column_index integer not null check (column_index between 1 and 18278),
  training_id uuid not null unique references public.trainings(id) on delete cascade,
  count_row integer not null default 7 check (count_row > 0),
  roster_start_row integer not null default 8 check (roster_start_row > 0),
  roster_end_row integer not null default 21 check (roster_end_row >= roster_start_row),
  queue_start_row integer not null default 24 check (queue_start_row > 0),
  queue_end_row integer not null default 40 check (queue_end_row >= queue_start_row),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spreadsheet_id, sheet_gid, column_index)
);

create table if not exists public.google_sheet_player_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  normalized_alias text not null check (normalized_alias = lower(trim(normalized_alias))),
  display_alias text not null,
  created_at timestamptz not null default now(),
  unique (normalized_alias),
  unique (user_id, normalized_alias)
);

create index if not exists google_sheet_player_aliases_user_idx
  on public.google_sheet_player_aliases (user_id);

create table if not exists public.google_sheet_commands (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  map_id uuid references public.google_sheet_training_maps(id) on delete set null,
  training_id uuid references public.trainings(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  spreadsheet_id text not null,
  sheet_gid bigint not null,
  cell_a1 text not null,
  action text not null check (action in ('join', 'cancel')),
  requested_name text not null,
  status text not null check (status in ('accepted', 'cancelled', 'needs_payment', 'rejected', 'duplicate', 'unmatched')),
  result jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists google_sheet_commands_training_idx
  on public.google_sheet_commands (training_id, received_at desc);
create index if not exists google_sheet_commands_status_idx
  on public.google_sheet_commands (status, received_at desc);

create table if not exists public.google_sheets_sync_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  training_id uuid not null references public.trainings(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists google_sheets_sync_outbox_due_idx
  on public.google_sheets_sync_outbox (status, next_attempt_at, created_at);

alter table public.google_sheet_training_maps enable row level security;
alter table public.google_sheet_player_aliases enable row level security;
alter table public.google_sheet_commands enable row level security;
alter table public.google_sheets_sync_outbox enable row level security;

drop policy if exists "google_sheet_training_maps_admin_all" on public.google_sheet_training_maps;
create policy "google_sheet_training_maps_admin_all"
  on public.google_sheet_training_maps for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "google_sheet_player_aliases_admin_all" on public.google_sheet_player_aliases;
create policy "google_sheet_player_aliases_admin_all"
  on public.google_sheet_player_aliases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "google_sheet_commands_admin_read" on public.google_sheet_commands;
create policy "google_sheet_commands_admin_read"
  on public.google_sheet_commands for select to authenticated
  using (public.is_admin());

drop policy if exists "google_sheets_sync_outbox_admin_read" on public.google_sheets_sync_outbox;
create policy "google_sheets_sync_outbox_admin_read"
  on public.google_sheets_sync_outbox for select to authenticated
  using (public.is_admin());

create or replace function public.enqueue_google_sheet_training_sync(
  p_training_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nedarām lieku darbu, kamēr treniņš nav piesaistīts nevienai aktīvai
  -- Sheets kolonnai. Pēc kartējuma izveides to ieliek savs triggers.
  if not exists (
    select 1 from public.google_sheet_training_maps m
     where m.training_id = p_training_id and m.enabled
  ) then
    return;
  end if;

  insert into public.google_sheets_sync_outbox (event_key, training_id)
  values (concat('training-snapshot:', p_training_id), p_training_id)
  on conflict (event_key) do update
    set status = 'pending',
        attempts = 0,
        next_attempt_at = now(),
        locked_at = null,
        last_error = null,
        updated_at = now();
end;
$$;

create or replace function public.enqueue_google_sheet_sync_on_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_google_sheet_training_sync(new.training_id);
  return new;
end;
$$;

drop trigger if exists registrations_enqueue_google_sheet_sync on public.registrations;
create trigger registrations_enqueue_google_sheet_sync
  after insert or update of status, registered_at, payment_id, team on public.registrations
  for each row execute function public.enqueue_google_sheet_sync_on_registration();

create or replace function public.enqueue_google_sheet_sync_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.training_id is not null and new.status is distinct from old.status then
    perform public.enqueue_google_sheet_training_sync(new.training_id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_enqueue_google_sheet_sync on public.payments;
create trigger payments_enqueue_google_sheet_sync
  after update of status on public.payments
  for each row execute function public.enqueue_google_sheet_sync_on_payment();

create or replace function public.enqueue_google_sheet_sync_on_map()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled then
    perform public.enqueue_google_sheet_training_sync(new.training_id);
  end if;
  return new;
end;
$$;

drop trigger if exists google_sheet_map_enqueue_sync on public.google_sheet_training_maps;
create trigger google_sheet_map_enqueue_sync
  after insert or update on public.google_sheet_training_maps
  for each row execute function public.enqueue_google_sheet_sync_on_map();

create or replace function public.process_google_sheet_reservation_command(
  p_event_id text,
  p_map_id uuid,
  p_user_id uuid,
  p_training_id uuid,
  p_spreadsheet_id text,
  p_sheet_gid bigint,
  p_cell_a1 text,
  p_action text,
  p_requested_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_id uuid;
  v_existing_result jsonb;
  v_training public.trainings%rowtype;
  v_player_type text;
  v_paid_until date;
  v_fixed_team text;
  v_registration_id uuid;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Šī funkcija ir pieejama tikai integrācijas servisam.' using errcode = '42501';
  end if;
  if p_action not in ('join', 'cancel') then
    raise exception 'Nederīga Sheets darbība.' using errcode = 'P0001';
  end if;

  insert into public.google_sheet_commands (
    event_id, map_id, training_id, user_id, spreadsheet_id, sheet_gid,
    cell_a1, action, requested_name, status
  ) values (
    p_event_id, p_map_id, p_training_id, p_user_id, p_spreadsheet_id, p_sheet_gid,
    p_cell_a1, p_action, p_requested_name, 'rejected'
  )
  on conflict (event_id) do nothing
  returning id into v_command_id;

  if v_command_id is null then
    select result into v_existing_result
      from public.google_sheet_commands
     where event_id = p_event_id;
    return coalesce(v_existing_result, jsonb_build_object('state', 'duplicate'))
      || jsonb_build_object('duplicate', true);
  end if;

  select t.* into v_training
    from public.trainings t
   where t.id = p_training_id
   for update;

  if not found then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Treniņš nav atrasts.');
  elsif p_action = 'cancel' then
    if v_training.status in ('completed', 'cancelled') or v_training.registration_closes_at <= now() then
      v_result := jsonb_build_object('state', 'rejected', 'message', 'Atcelšana vairs nav iespējama.');
    else
      update public.registrations
         set status = 'cancelled', cancelled_at = now()
       where training_id = p_training_id
         and user_id = p_user_id
         and status <> 'cancelled'
      returning id into v_registration_id;

      if v_registration_id is null then
        v_result := jsonb_build_object('state', 'duplicate', 'message', 'Aktīvs pieteikums nav atrasts.');
      else
        v_result := jsonb_build_object('state', 'cancelled', 'message', 'Pieteikums atcelts.');
      end if;
    end if;
  elsif v_training.status <> 'open' or v_training.registration_closes_at <= now() then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Reģistrācija ir slēgta.');
  else
    select player_type, semester_paid_until,
           case when fixed_team in ('black', 'white') then fixed_team else null end
      into v_player_type, v_paid_until, v_fixed_team
      from public.users
     where id = p_user_id;

    if not found then
      v_result := jsonb_build_object('state', 'rejected', 'message', 'Spēlētājs nav atrasts.');
    elsif v_player_type <> 'core' or v_paid_until is null or v_paid_until < current_date then
      v_result := jsonb_build_object(
        'state', 'needs_payment',
        'message', 'Šim pieteikumam nepieciešama apmaksa 3sm.lv.'
      );
    else
      insert into public.registrations (
        training_id, user_id, status, team, cancelled_at, registered_at
      ) values (
        p_training_id, p_user_id, 'confirmed', v_fixed_team, null, now()
      )
      on conflict (training_id, user_id) do update
        set status = 'confirmed',
            team = excluded.team,
            cancelled_at = null,
            registered_at = now()
        where public.registrations.status = 'cancelled'
      returning id into v_registration_id;

      if v_registration_id is null then
        v_result := jsonb_build_object('state', 'duplicate', 'message', 'Spēlētājs jau ir pieteicies.');
      else
        v_result := jsonb_build_object(
          'state', 'accepted',
          'message', 'Pieteikums pieņemts. Sastāvs galīgi tiks fiksēts pēc reģistrācijas slēgšanas.'
        );
      end if;
    end if;
  end if;

  update public.google_sheet_commands
     set status = (v_result->>'state')::text,
         result = v_result,
         processed_at = now()
   where id = v_command_id;

  return v_result;
end;
$$;

revoke all on function public.enqueue_google_sheet_training_sync(uuid) from public;
revoke all on function public.process_google_sheet_reservation_command(text, uuid, uuid, uuid, text, bigint, text, text, text) from public;
grant execute on function public.enqueue_google_sheet_training_sync(uuid) to service_role;
grant execute on function public.process_google_sheet_reservation_command(text, uuid, uuid, uuid, text, bigint, text, text, text) to service_role;
