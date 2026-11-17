-- Esošajā oktobra tabulā 8.–21. rinda ir pamatsastāvs, 22. rinda nav
-- rezervācija, bet 23. rinda un turpmāk ir rezerve. Importēšanai lasa visu
-- datuma kolonnu. Esošā 40. rinda paliek tikai minimālais tīrīšanas diapazons;
-- jaunais kods dinamiskam rezervistu sarakstam lasa un raksta arī zemāk.
alter table public.google_sheet_training_maps
  alter column queue_start_row set default 23;

update public.google_sheet_training_maps
   set queue_start_row = 23,
       updated_at = now()
 where spreadsheet_id = '1N7wveM113ekr_oO1Z0Fhmn0U7N25_BXjny7tdlo-0Mg'
   and queue_start_row <> 23;

-- Reģistrācijas statuss ir atkarīgs no kolonnas rindas. Funkcija pārbauda
-- kartējumu arī pati, jo to izmanto gan Apps Script, gan pilnas kolonnas scans.
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
  v_map public.google_sheet_training_maps%rowtype;
  v_training public.trainings%rowtype;
  v_row integer;
  v_requested_status text;
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

  select m.* into v_map
    from public.google_sheet_training_maps m
   where m.id = p_map_id
     and m.training_id = p_training_id
     and m.spreadsheet_id = p_spreadsheet_id
     and m.sheet_gid = p_sheet_gid
     and m.enabled;

  if not found then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Nederīgs vai izslēgts Sheets kartējums.');
  elsif p_cell_a1 !~ '^[A-Za-z]+[0-9]+$' then
    v_result := jsonb_build_object('state', 'rejected', 'message', 'Nederīga Sheets šūna.');
  else
    v_row := substring(p_cell_a1 from '[0-9]+$')::integer;
    if v_row between v_map.roster_start_row and v_map.roster_end_row then
      v_requested_status := 'confirmed';
    elsif v_row between v_map.queue_start_row and 10000 then
      v_requested_status := 'queue';
    else
      v_result := jsonb_build_object('state', 'rejected', 'message', 'Šī šūna nav rezervāciju zona.');
    end if;
  end if;

  if v_result is null then
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
           set status = 'cancelled', cancelled_at = now(), queue_position = null
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
      else
        -- Apmaksa nav priekšnoteikums (00005): neapmaksāts spēlētājs tiek
        -- pieņemts, un sastāva fiksēšanas cron viņam uzliek parādu.
        -- Fiksētā komanda tikai pamatsastāvam ar derīgu sezonas maksu.
        if v_player_type <> 'core' or v_paid_until is null or v_paid_until < current_date then
          v_fixed_team := null;
        end if;

        insert into public.registrations (
          training_id, user_id, status, team, queue_position, cancelled_at, registered_at
        ) values (
          p_training_id, p_user_id, v_requested_status, v_fixed_team,
          case when v_requested_status = 'queue' then v_row - v_map.queue_start_row + 1 else null end,
          null, now()
        )
        on conflict (training_id, user_id) do update
          set status = excluded.status,
              team = excluded.team,
              queue_position = excluded.queue_position,
              cancelled_at = null,
              registered_at = case
                when public.registrations.status = 'cancelled' then now()
                else public.registrations.registered_at
              end
          where public.registrations.status = 'cancelled'
             or public.registrations.status is distinct from excluded.status
        returning id into v_registration_id;

        if v_registration_id is null then
          v_result := jsonb_build_object('state', 'duplicate', 'message', 'Spēlētājs jau ir pieteicies.');
        else
          v_result := jsonb_build_object(
            'state', 'accepted',
            'message', case when v_requested_status = 'queue'
              then 'Pieteikums pieņemts rezervē.'
              else 'Pieteikums pieņemts pamatsastāvā.' end
          );
        end if;
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

revoke all on function public.process_google_sheet_reservation_command(text, uuid, uuid, uuid, text, bigint, text, text, text) from public;
grant execute on function public.process_google_sheet_reservation_command(text, uuid, uuid, uuid, text, bigint, text, text, text) to service_role;
