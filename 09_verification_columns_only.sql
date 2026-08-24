-- ============================================
-- CAPTIVO — Rattrapage : colonnes de vérification manquantes sur photographers
-- (le bucket et ses règles de sécurité sont déjà en place, fait séparément)
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

alter table photographers add column if not exists verification_status text not null default 'unverified';
-- valeurs possibles : 'unverified' | 'pending' | 'verified' | 'rejected'
alter table photographers add column if not exists verification_siret text;
alter table photographers add column if not exists verification_document_path text;
alter table photographers add column if not exists verification_submitted_at timestamp with time zone;
alter table photographers add column if not exists verification_note text; -- motif de refus, rempli par vous (admin)

-- ============================================
-- Protection anti-triche : un photographe ne peut jamais se "auto-vérifier"
-- Seul vous (via le Table Editor Supabase, accès admin) pouvez passer une
-- fiche à 'verified' ou 'rejected'. Depuis le site, la seule transition
-- autorisée pour un utilisateur normal est vers 'pending' (soumission).
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
