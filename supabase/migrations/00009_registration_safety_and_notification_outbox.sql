-- P0 + P1: droša pieteikšanās un uzticams paziņojumu outbox.
--
-- Lietotājs vairs nedrīkst pa tiešo mainīt registrations.status/team.
-- Tā vietā viņš izsauc validētas SECURITY DEFINER funkcijas. Veiksmīgs
-- pieteikums tajā pašā transakcijā ievieto paziņojuma notikumu outbox tabulā.

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('registration_update')),
  channel text not null check (channel in ('whatsapp_group')),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete cascade,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts int not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  provider_message_sid text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_outbox_due_idx
  on public.notification_outbox (status, next_attempt_at, created_at);
create index if not exists notification_outbox_registration_idx
  on public.notification_outbox (registration_id);

alter table public.notification_outbox enable row level security;

drop policy if exists "notification_outbox_admin_read" on public.notification_outbox;
create policy "notification_outbox_admin_read"
  on public.notification_outbox
  for select
  to authenticated
  using (public.is_admin());

-- Tiešie insert/update no pārlūka atļauj mainīt jebkuru kolonnu, ne tikai
-- atcelšanu. Visi spēlētāju rakstīšanas ceļi zemāk izmanto RPC funkcijas.
drop policy if exists "registrations_insert_self" on public.registrations;
drop policy if exists "registrations_update_self" on public.registrations;

create or replace function public.registration_notification_payload(
  p_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_training public.trainings%rowtype;
  v_player_name text;
  v_active_count int;
  v_confirmed_count int;
  v_queue_count int;
begin
  select r.*
    into v_registration
    from public.registrations r
   where r.id = p_registration_id;

  if not found then
    raise exception 'Reģistrācija nav atrasta.' using errcode = 'P0001';
  end if;

  select t.*
    into v_training
    from public.trainings t
   where t.id = v_registration.training_id;

  if not found then
    raise exception 'Treniņš nav atrasts.' using errcode = 'P0001';
  end if;

  select coalesce(nullif(trim(u.nickname), ''), nullif(trim(u.name), ''), 'Spēlētājs')
    into v_player_name
    from public.users u
   where u.id = v_registration.user_id;

  -- Neapmaksāts individuālais maksājums nav īsts pieteikums un neskaitās
  -- ne grupas ziņā, ne pieejamo vietu aprēķinā.
  select count(*)::int,
         count(*) filter (where r.status = 'confirmed')::int,
         count(*) filter (where r.status = 'queue')::int
    into v_active_count, v_confirmed_count, v_queue_count
    from public.registrations r
    left join public.payments p on p.id = r.payment_id
   where r.training_id = v_training.id
     and r.status in ('confirmed', 'queue')
     and (r.payment_id is null or p.status = 'paid');

  return jsonb_build_object(
    'player_name', coalesce(v_player_name, 'Spēlētājs'),
    'training_date', v_training.date,
    'start_time', v_training.start_time,
    'registration_closes_at', v_training.registration_closes_at,
    'active_count', v_active_count,
    'confirmed_count', v_confirmed_count,
    'queue_count', v_queue_count,
    'max_players', v_training.max_players,
    'remaining_slots', greatest(v_training.max_players - v_active_count, 0)
  );
end;
$$;

create or replace function public.enqueue_registration_notification(
  p_registration_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_payment_status text;
  v_outbox_id uuid;
  v_event_key text;
begin
  select r.*
    into v_registration
    from public.registrations r
   where r.id = p_registration_id;

  if not found then
    raise exception 'Reģistrācija nav atrasta.' using errcode = 'P0001';
  end if;

  -- Spēlētājs drīkst rindā ievietot tikai savu pieteikumu; administrators
  -- un servera service role drīkst apstrādāt jebkuru pieteikumu.
  if auth.role() is distinct from 'service_role'
     and not public.is_admin()
     and v_registration.user_id <> auth.uid() then
    raise exception 'Nav tiesību veidot šo paziņojumu.' using errcode = '42501';
  end if;

  if v_registration.status = 'cancelled' then
    raise exception 'Atceltam pieteikumam paziņojumu neveido.' using errcode = 'P0001';
  end if;

  if v_registration.payment_id is not null then
    select p.status into v_payment_status
      from public.payments p
     where p.id = v_registration.payment_id;
    if v_payment_status is distinct from 'paid' then
      raise exception 'Pieteikuma maksājums vēl nav apstiprināts.' using errcode = 'P0001';
    end if;
  end if;

  -- registered_at mainās, kad spēlētājs piesakās atkārtoti, tāpēc katram
  -- jaunam pieteikuma ciklam ir savs notikums, bet webhook retry nedublē ziņu.
  v_event_key := concat('registration:', v_registration.id, ':', v_registration.registered_at);

  insert into public.notification_outbox (
    event_key,
    event_type,
    channel,
    registration_id,
    training_id,
    payload
  ) values (
    v_event_key,
    'registration_update',
    'whatsapp_group',
    v_registration.id,
    v_registration.training_id,
    public.registration_notification_payload(v_registration.id)
  )
  on conflict (event_key) do update
    set updated_at = now()
  returning id into v_outbox_id;

  return v_outbox_id;
end;
$$;

-- Centrālais outbox punkts: tas sedz visus tagadējos un nākamos servera
-- rakstīšanas ceļus, nepaļaujoties uz to, ka katrs TypeScript handleris
-- atceras izsaukt enqueue funkciju.
create or replace function public.enqueue_registration_notification_on_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_status text;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  if new.payment_id is not null then
    select status into v_payment_status from public.payments where id = new.payment_id;
    if v_payment_status is distinct from 'paid' then
      return new;
    end if;
  end if;

  perform public.enqueue_registration_notification(new.id);
  return new;
end;
$$;

drop trigger if exists registrations_enqueue_notification on public.registrations;
create trigger registrations_enqueue_notification
  after insert or update of registered_at, payment_id on public.registrations
  for each row execute function public.enqueue_registration_notification_on_change();

create or replace function public.enqueue_registration_notification_on_payment_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration_id uuid;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.type <> 'single_training' then
    return new;
  end if;

  select id into v_registration_id
    from public.registrations
   where payment_id = new.id
     and status <> 'cancelled';

  if v_registration_id is not null then
    perform public.enqueue_registration_notification(v_registration_id);
  end if;
  return new;
end;
$$;

drop trigger if exists payments_enqueue_registration_notification on public.payments;
create trigger payments_enqueue_registration_notification
  after update of status on public.payments
  for each row execute function public.enqueue_registration_notification_on_payment_paid();

create or replace function public.register_core_for_training(
  p_training_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_training public.trainings%rowtype;
  v_fixed_team text;
  v_registration_id uuid;
begin
  if v_user_id is null then
    raise exception 'Nav pieslēgts.' using errcode = '42501';
  end if;

  -- Bloķē konkrēto treniņu, lai paralēli pieteikumi iegūtu konsekventu
  -- paziņojuma momentuzņēmumu.
  select t.* into v_training
    from public.trainings t
   where t.id = p_training_id
   for update;

  if not found then
    raise exception 'Treniņš nav atrasts.' using errcode = 'P0001';
  end if;
  if v_training.status <> 'open' then
    raise exception 'Reģistrācija slēgta.' using errcode = 'P0001';
  end if;
  if v_training.registration_closes_at <= now() then
    raise exception 'Reģistrācijas laiks beidzies.' using errcode = 'P0001';
  end if;

  select case when u.fixed_team in ('black', 'white') then u.fixed_team else null end
    into v_fixed_team
    from public.users u
   where u.id = v_user_id
     and u.player_type = 'core'
     and u.semester_paid_until >= current_date;

  if not found then
    raise exception 'Šim pieteikumam nepieciešams individuāls maksājums.' using errcode = 'P0001';
  end if;

  insert into public.registrations (
    training_id, user_id, status, team, cancelled_at, registered_at
  ) values (
    v_training.id, v_user_id, 'confirmed', v_fixed_team, null, now()
  )
  on conflict (training_id, user_id) do update
    set status = 'confirmed',
        team = excluded.team,
        cancelled_at = null,
        registered_at = now()
    where public.registrations.status = 'cancelled'
  returning id into v_registration_id;

  if v_registration_id is null then
    raise exception 'Tu jau esi pieteicies.' using errcode = 'P0001';
  end if;

  return v_registration_id;
end;
$$;

create or replace function public.cancel_my_registration(
  p_training_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_training public.trainings%rowtype;
begin
  if v_user_id is null then
    raise exception 'Nav pieslēgts.' using errcode = '42501';
  end if;

  select t.* into v_training
    from public.trainings t
   where t.id = p_training_id
   for update;

  if not found then
    raise exception 'Treniņš nav atrasts.' using errcode = 'P0001';
  end if;
  if v_training.status in ('completed', 'cancelled') then
    raise exception 'Treniņš jau pabeigts vai atcelts.' using errcode = 'P0001';
  end if;
  if v_training.registration_closes_at <= now() then
    raise exception 'Atcelšana vairs nav iespējama (pēc 17:00).' using errcode = 'P0001';
  end if;

  update public.registrations
     set status = 'cancelled',
         cancelled_at = now()
   where training_id = p_training_id
     and user_id = v_user_id
     and status <> 'cancelled';

  if not found then
    raise exception 'Aktīvs pieteikums nav atrasts.' using errcode = 'P0001';
  end if;

  return true;
end;
$$;

-- Tikai sākotnējais iesniedzējs drīkst labot savu gaidošo rezultātu; pārējo
-- labošanu un apstiprināšanu saglabājam administratoram.
create or replace function public.submit_or_update_my_pending_result(
  p_training_id uuid,
  p_black_score int,
  p_white_score int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.results%rowtype;
  v_result_id uuid;
begin
  if v_user_id is null then
    raise exception 'Nav pieslēgts.' using errcode = '42501';
  end if;
  if p_black_score < 0 or p_white_score < 0 or p_black_score > 99 or p_white_score > 99 then
    raise exception 'Nederīgi rezultāti.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.registrations r
     where r.training_id = p_training_id
       and r.user_id = v_user_id
       and r.status = 'confirmed'
  ) then
    raise exception 'Rezultātu drīkst iesniegt tikai apstiprināts dalībnieks.' using errcode = '42501';
  end if;

  select r.* into v_result
    from public.results r
   where r.training_id = p_training_id
   for update;

  if found then
    if v_result.status = 'approved' then
      raise exception 'Rezultāts jau apstiprināts.' using errcode = 'P0001';
    end if;
    if v_result.submitted_by <> v_user_id then
      raise exception 'Rezultātu jau iesniedzis cits spēlētājs; to var labot administrators.' using errcode = '42501';
    end if;

    update public.results
       set black_score = p_black_score,
           white_score = p_white_score
     where id = v_result.id
     returning id into v_result_id;
  else
    insert into public.results (
      training_id, black_score, white_score, submitted_by
    ) values (
      p_training_id, p_black_score, p_white_score, v_user_id
    )
    returning id into v_result_id;
  end if;

  return v_result_id;
end;
$$;

revoke all on function public.registration_notification_payload(uuid) from public;
revoke all on function public.enqueue_registration_notification(uuid) from public;
revoke all on function public.register_core_for_training(uuid) from public;
revoke all on function public.cancel_my_registration(uuid) from public;
revoke all on function public.submit_or_update_my_pending_result(uuid, int, int) from public;
revoke all on function public.enqueue_registration_notification_on_change() from public;
revoke all on function public.enqueue_registration_notification_on_payment_paid() from public;

grant execute on function public.enqueue_registration_notification(uuid) to authenticated, service_role;
grant execute on function public.register_core_for_training(uuid) to authenticated;
grant execute on function public.cancel_my_registration(uuid) to authenticated;
grant execute on function public.submit_or_update_my_pending_result(uuid, int, int) to authenticated;
