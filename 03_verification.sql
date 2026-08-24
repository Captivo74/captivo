-- ============================================
-- CAPTIVO — Mise à jour n°3 : vérification d'identité des photographes
-- À coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter APRÈS les scripts 01 et 02)
-- ============================================

-- Nouvelles colonnes sur la fiche photographe
alter table photographers add column if not exists verification_status text not null default 'unverified';
-- valeurs possibles : 'unverified' | 'pending' | 'verified' | 'rejected'
alter table photographers add column if not exists verification_siret text;
alter table photographers add column if not exists verification_document_path text;
alter table photographers add column if not exists verification_submitted_at timestamp with time zone;
alter table photographers add column if not exists verification_note text; -- motif de refus, rempli par vous (admin)

-- ============================================
-- Protection anti-triche : un photographe ne peut jamais se "auto-vérifier"
-- Seul vous (via le Table Editor Supabase, qui utilise un accès admin) pouvez
-- passer une fiche à 'verified' ou 'rejected'. Depuis le site, la seule
-- transition autorisée pour un utilisateur normal est vers 'pending' (soumission).
-- ============================================
create or replace function protect_verification_status()
returns trigger as $$
begin
  if NEW.verification_status is distinct from OLD.verification_status then
    if auth.role() <> 'service_role' then
      if NEW.verification_status not in ('pending') then
        NEW.verification_status := OLD.verification_status;
      end if;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_verification_status on photographers;
create trigger trg_protect_verification_status
before update on photographers
for each row execute function protect_verification_status();

-- ============================================
-- Stockage des documents justificatifs (PRIVÉ — jamais public, contrairement aux photos de portfolio)
-- ============================================
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do nothing;

create policy "Photographe upload son propre justificatif" on storage.objects
  for insert with check (bucket_id = 'verification-docs' and auth.uid() is not null);
create policy "Photographe voit son propre justificatif" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select id::text from photographers where user_id = auth.uid())
  );

-- Note : en tant que propriétaire du projet Supabase, vous pouvez toujours consulter
-- tous les fichiers du bucket "verification-docs" depuis Storage > verification-docs
-- dans le tableau de bord Supabase, quelle que soit cette politique (accès admin).
