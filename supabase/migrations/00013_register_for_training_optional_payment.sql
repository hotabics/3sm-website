-- Apvieno 00005 (apmaksa neobligāta) ar 00009 (pieteikšanās caur DB
-- funkciju zem rindas bloķēšanas). 00009 noņēma spēlētāju tiešās
-- INSERT/UPDATE tiesības uz registrations, tāpēc arī rezervisti tagad
-- piesakās caur šo funkciju, nevis rakstot tabulā.
--
-- Pamatsastāvs ar derīgu sezonas maksu → 'confirmed' (+ fiksētā komanda).
-- Pārējie → 'queue'; sastāva fiksēšanas cron viņus sakārto un uzliek parādu.

create or replace function public.register_for_training(
  p_training_id uuid
)
returns table (registration_id uuid, registration_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_training public.trainings%rowtype;
  v_user public.users%rowtype;
  v_core_paid boolean;
  v_status text;
  v_team text;
  v_registration_id uuid;
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
  if v_training.status <> 'open' then
    raise exception 'Reģistrācija slēgta.' using errcode = 'P0001';
  end if;
  if v_training.registration_closes_at <= now() then
    raise exception 'Reģistrācijas laiks beidzies.' using errcode = 'P0001';
  end if;

  select u.* into v_user from public.users u where u.id = v_user_id;
  if not found then
    raise exception 'Profils nav atrasts.' using errcode = 'P0001';
  end if;

  v_core_paid := v_user.player_type = 'core'
    and v_user.semester_paid_until is not null
    and v_user.semester_paid_until >= current_date;
  v_status := case when v_core_paid then 'confirmed' else 'queue' end;
  v_team := case
    when v_core_paid and v_user.fixed_team in ('black', 'white') then v_user.fixed_team
    else null
  end;

  insert into public.registrations (
    training_id, user_id, status, team, cancelled_at, registered_at
  ) values (
    v_training.id, v_user_id, v_status, v_team, null, now()
  )
  on conflict (training_id, user_id) do update
    set status = excluded.status,
        team = excluded.team,
        cancelled_at = null,
        registered_at = now()
    where public.registrations.status = 'cancelled'
  returning id into v_registration_id;

  if v_registration_id is null then
    raise exception 'Tu jau esi pieteicies.' using errcode = 'P0001';
  end if;

  return query select v_registration_id, v_status;
end;
$$;

revoke all on function public.register_for_training(uuid) from public, anon;
grant execute on function public.register_for_training(uuid) to authenticated;

-- Vecā tikai-pamatsastāva funkcija vairs netiek izsaukta.
drop function if exists public.register_core_for_training(uuid);
