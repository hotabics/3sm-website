-- Sheets dalībnieks bez 3SM konta ir redzams kā neidentificēts profils.
-- Tas NAV Auth lietotājs: viņam nav e-pasta, paroles, sesijas vai maksājumu.
-- Reģistrētajiem profiliem auth_user_id saglabā FK un dzēšanas kaskādi.
alter table public.users
  add column identity_status text not null default 'identified'
    check (identity_status in ('identified', 'unidentified')),
  add column auth_user_id uuid unique references auth.users(id) on delete cascade,
  add column google_sheet_spreadsheet_id text,
  add column google_sheet_normalized_name text;

update public.users set auth_user_id = id;

alter table public.users
  drop constraint if exists users_id_fkey,
  alter column email drop not null,
  add constraint users_identity_source_check check (
    (
      identity_status = 'identified'
      and auth_user_id = id
      and email is not null
      and google_sheet_spreadsheet_id is null
      and google_sheet_normalized_name is null
    )
    or (
      identity_status = 'unidentified'
      and auth_user_id is null
      and email is null
      and google_sheet_spreadsheet_id is not null
      and google_sheet_normalized_name is not null
      and length(google_sheet_normalized_name) between 1 and 120
    )
  );

create unique index users_google_sheet_guest_unique
  on public.users (google_sheet_spreadsheet_id, google_sheet_normalized_name)
  where identity_status = 'unidentified';

-- Jauns OAuth konts joprojām saņem ar Auth saistītu profilu.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, auth_user_id, email, avatar_url, name)
  values (
    new.id, new.id, new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Parasts lietotājs nevar sevi pārvērst par Sheets viesi vai pārņemt viesi.
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self"
  on public.users for insert to authenticated
  with check (
    auth.uid() = id and auth_user_id = auth.uid()
    and identity_status = 'identified'
    and email = auth.jwt()->>'email'
  );

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
  on public.users for update to authenticated
  using (auth.uid() = id and identity_status = 'identified')
  with check (
    auth.uid() = id and auth_user_id = auth.uid()
    and identity_status = 'identified'
    and email = auth.jwt()->>'email'
  );

grant select (identity_status) on public.users to anon;

-- Idempotenta, atomāra komanda gan Apps Script, gan pilnas kolonnas importam.
create or replace function public.process_google_sheet_guest_command(
  p_event_id text,
  p_map_id uuid,
  p_column_index integer,
  p_cell_a1 text,
  p_action text,
  p_requested_name text,
  p_normalized_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_command_id uuid;
  v_existing_result jsonb;
  v_map public.google_sheet_training_maps%rowtype;
  v_training public.trainings%rowtype;
  v_row integer;
  v_status text;
  v_guest_id uuid;
  v_registration_id uuid;
  v_result jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Tikai integrācijas servisam.' using errcode = '42501';
  end if;
  if p_action not in ('join', 'cancel')
     or nullif(trim(p_requested_name), '') is null
     or length(p_requested_name) > 120
     or nullif(trim(p_normalized_name), '') is null
     or length(p_normalized_name) > 120 then
    raise exception 'Nederīga Sheets komanda.' using errcode = 'P0001';
  end if;

  select * into v_map
    from public.google_sheet_training_maps
   where id = p_map_id and enabled and column_index = p_column_index;
  if not found then
    return jsonb_build_object('state', 'rejected', 'message', 'Nederīgs Sheets kartējums.');
  end if;
  if p_cell_a1 !~ '^[A-Za-z]+[0-9]+$' then
    return jsonb_build_object('state', 'rejected', 'message', 'Nederīga Sheets šūna.');
  end if;
  v_row := substring(p_cell_a1 from '[0-9]+$')::integer;
  if v_row between v_map.roster_start_row and v_map.roster_end_row then
    v_status := 'confirmed';
  elsif v_row between v_map.queue_start_row and 10000 then
    v_status := 'queue';
  else
    return jsonb_build_object('state', 'rejected', 'message', 'Šī šūna nav rezervāciju zona.');
  end if;

  insert into public.google_sheet_commands (
    event_id, map_id, training_id, spreadsheet_id, sheet_gid,
    cell_a1, action, requested_name, status
  ) values (
    p_event_id, v_map.id, v_map.training_id, v_map.spreadsheet_id, v_map.sheet_gid,
    p_cell_a1, p_action, p_requested_name, 'rejected'
  )
  on conflict (event_id) do nothing
  returning id into v_command_id;
  if v_command_id is null then
    select result into v_existing_result from public.google_sheet_commands where event_id = p_event_id;
    return coalesce(v_existing_result, jsonb_build_object('state', 'duplicate'))
      || jsonb_build_object('duplicate', true);
  end if;

  select * into v_training from public.trainings where id = v_map.training_id for update;
  if not found then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Treniņš nav atrasts.');
  elsif p_action = 'cancel' then
    if v_training.status in ('completed', 'cancelled') or v_training.registration_closes_at <= now() then
      v_result := jsonb_build_object('state', 'rejected', 'message', 'Atcelšana vairs nav iespējama.');
    else
      select id into v_guest_id from public.users
       where identity_status = 'unidentified'
         and google_sheet_spreadsheet_id = v_map.spreadsheet_id
         and google_sheet_normalized_name = p_normalized_name;
      if v_guest_id is null then
        v_result := jsonb_build_object('state', 'duplicate', 'message', 'Aktīvs pieteikums nav atrasts.');
      else
        update public.registrations
           set status = 'cancelled', cancelled_at = now(), queue_position = null
         where training_id = v_map.training_id and user_id = v_guest_id and status <> 'cancelled'
        returning id into v_registration_id;
        v_result := case when v_registration_id is null
          then jsonb_build_object('state', 'duplicate', 'message', 'Aktīvs pieteikums nav atrasts.')
          else jsonb_build_object('state', 'cancelled', 'message', 'Neidentificētais pieteikums atcelts.') end;
      end if;
    end if;
  elsif v_training.status <> 'open' or v_training.registration_closes_at <= now() then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Reģistrācija ir slēgta.');
  else
    insert into public.users (
      id, name, identity_status, player_type,
      google_sheet_spreadsheet_id, google_sheet_normalized_name
    ) values (
      gen_random_uuid(), p_requested_name, 'unidentified', 'reserve',
      v_map.spreadsheet_id, p_normalized_name
    )
    on conflict (google_sheet_spreadsheet_id, google_sheet_normalized_name)
      where identity_status = 'unidentified'
    do update set name = excluded.name
    returning id into v_guest_id;

    insert into public.registrations (
      training_id, user_id, status, queue_position, cancelled_at, registered_at
    ) values (
      v_map.training_id, v_guest_id, v_status,
      case when v_status = 'queue' then v_row - v_map.queue_start_row + 1 else null end,
      null, now()
    )
    on conflict (training_id, user_id) do update
      set status = excluded.status,
          queue_position = excluded.queue_position,
          cancelled_at = null,
          registered_at = case when public.registrations.status = 'cancelled'
            then now() else public.registrations.registered_at end
      where public.registrations.status = 'cancelled'
         or public.registrations.status is distinct from excluded.status
    returning id into v_registration_id;

    v_result := case when v_registration_id is null
      then jsonb_build_object('state', 'duplicate', 'message', 'Spēlētājs jau ir pieteicies.', 'user_id', v_guest_id)
      else jsonb_build_object(
        'state', 'accepted', 'message',
        case when v_status = 'queue'
          then 'Neidentificēts spēlētājs pieņemts rezervē.'
          else 'Neidentificēts spēlētājs pieņemts pamatsastāvā.' end,
        'user_id', v_guest_id
      ) end;
  end if;

  update public.google_sheet_commands
     set user_id = v_guest_id,
         status = v_result->>'state',
         result = v_result,
         processed_at = now()
   where id = v_command_id;
  return v_result;
end;
$$;

revoke all on function public.process_google_sheet_guest_command(text, uuid, integer, text, text, text, text) from public;
grant execute on function public.process_google_sheet_guest_command(text, uuid, integer, text, text, text, text) to service_role;

-- Kad admin apstiprina, kam pieder Sheets vārds, pārvieto viesu pieteikumus
-- pie īstā profila vienā transakcijā un noņem dublikāta viesu profilu.
create or replace function public.link_google_sheet_guest_to_user(
  p_spreadsheet_id text,
  p_normalized_name text,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_reg public.registrations%rowtype;
  v_existing public.registrations%rowtype;
  v_linked integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Tikai integrācijas servisam.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.google_sheet_player_aliases
     where normalized_alias = p_normalized_name and user_id = p_user_id
  ) then
    raise exception 'Vārds nav apstiprināts šim spēlētājam.' using errcode = 'P0001';
  end if;
  select id into v_guest_id from public.users
   where identity_status = 'unidentified'
     and google_sheet_spreadsheet_id = p_spreadsheet_id
     and google_sheet_normalized_name = p_normalized_name
   for update;
  if v_guest_id is null then return 0; end if;

  for v_reg in select * from public.registrations where user_id = v_guest_id for update loop
    select * into v_existing from public.registrations
     where training_id = v_reg.training_id and user_id = p_user_id for update;
    if not found then
      update public.registrations set user_id = p_user_id where id = v_reg.id;
    elsif v_existing.status = 'cancelled' and v_reg.status <> 'cancelled' then
      update public.registrations
         set status = v_reg.status, queue_position = v_reg.queue_position,
             cancelled_at = null, registered_at = v_reg.registered_at
       where id = v_existing.id;
      delete from public.registrations where id = v_reg.id;
    else
      delete from public.registrations where id = v_reg.id;
    end if;
    perform public.enqueue_google_sheet_training_sync(v_reg.training_id);
    v_linked := v_linked + 1;
  end loop;

  update public.google_sheet_commands set user_id = p_user_id where user_id = v_guest_id;
  update public.match_awards set user_id = p_user_id where user_id = v_guest_id;
  delete from public.users where id = v_guest_id;
  return v_linked;
end;
$$;

revoke all on function public.link_google_sheet_guest_to_user(text, text, uuid) from public;
grant execute on function public.link_google_sheet_guest_to_user(text, text, uuid) to service_role;
