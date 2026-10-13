-- ============================================
-- CAPTIVO — Calendrier des créneaux
-- Ajoute le style de photo à chaque créneau et un statut "réservé"
-- (au lieu de supprimer le créneau) pour pouvoir afficher les jours complets en rouge.
-- À coller dans Supabase > SQL Editor > New query > Run
-- ⚠ À exécuter AVANT de déposer la nouvelle version du site sur GitHub.
-- ============================================

alter table slots add column if not exists style text;                       -- null = valable pour tous les styles (anciens créneaux)
alter table slots add column if not exists slot_time text;                   -- heure, ex. 14:00
alter table slots add column if not exists booked boolean not null default false;

-- ---------- Réservation atomique : crée la demande ET marque le créneau réservé ----------
-- (empêche deux clients de réserver le même créneau en même temps)
create or replace function request_booking(
  p_slot_id uuid,
  p_client_name text,
  p_client_email text,
  p_style text
) returns booking_requests
language plpgsql security definer set search_path = public as $$
declare
  s slots%rowtype;
  b booking_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  select * into s from slots where id = p_slot_id for update;
  if not found or s.booked then
    raise exception 'slot_unavailable';
  end if;

  insert into booking_requests (photographer_id, client_id, client_name, client_email, style, slot_label, slot_date, status, client_notified)
  values (s.photographer_id, auth.uid(), p_client_name, p_client_email, p_style, s.label, s.slot_date, 'pending', true)
  returning * into b;

  update slots set booked = true where id = s.id;
  return b;
end $$;

-- ---------- Libération du créneau (refus / annulation) ----------
-- Autorisé uniquement pour le photographe concerné ou le client qui a fait la demande.
create or replace function release_slot(
  p_photographer_id uuid,
  p_label text,
  p_slot_date date,
  p_style text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;

  if not exists (
    select 1 from booking_requests br
    where br.photographer_id = p_photographer_id
      and br.slot_label = p_label
      and ( br.client_id = auth.uid()
            or p_photographer_id in (select id from photographers where user_id = auth.uid()) )
  ) then
    raise exception 'Action non autorisée.';
  end if;

  select id into sid from slots
  where photographer_id = p_photographer_id and label = p_label and booked = true
  limit 1;

  if sid is not null then
    update slots set booked = false where id = sid;
  else
    -- créneau supprimé par l'ancienne version du site : on le recrée
    insert into slots (photographer_id, label, slot_date, style, booked)
    values (p_photographer_id, p_label, p_slot_date, p_style, false);
  end if;
end $$;

grant execute on function request_booking(uuid, text, text, text) to authenticated;
grant execute on function release_slot(uuid, text, date, text) to authenticated;
