-- Maksājums vairs nav priekšnoteikums pieteikumam. Pieteikties var ar
-- vienu pieskārienu; ja spēlētājs tiek sastāvā un viņam nav derīgas sezonas
-- maksas, sastāva fiksēšanas brīdī (cron) viņam tiek uzlikts parāds.
--
-- Parāds = registrations.amount_due_cents > 0, status = 'confirmed',
-- treniņš 'closed'/'completed', un saistītais maksājums nav 'paid'.

alter table public.registrations
  add column if not exists amount_due_cents int not null default 0
    check (amount_due_cents >= 0);

create index if not exists registrations_due_idx
  on public.registrations (user_id)
  where amount_due_cents > 0;

-- Spēlētājs drīkst atjaunināt savu rindu (atcelt / pieteikties atpakaļ),
-- bet nedrīkst pats sev nodzēst parādu vai piesaistīt svešu maksājumu.
-- Service role (cron, webhook, servera darbības) un admini — drīkst.
create or replace function public.registrations_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'authenticated' or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.amount_due_cents := 0;
    new.payment_id := null;
  else
    if new.amount_due_cents is distinct from old.amount_due_cents
       or new.payment_id is distinct from old.payment_id then
      raise exception 'Šo lauku drīkst mainīt tikai admins.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_guard on public.registrations;
create trigger registrations_guard
  before insert or update on public.registrations
  for each row execute function public.registrations_guard();
