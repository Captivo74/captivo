-- ============================================
-- CAPTIVO — Mise à jour n°4 : panel d'administration
-- À coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter APRÈS les scripts 01, 02 et 03)
-- ============================================

-- Table des administrateurs. Personne ne peut s'y ajouter soi-même depuis le site :
-- aucune politique d'insertion n'est créée pour les rôles anon/authenticated.
-- Pour VOUS ajouter comme admin (à faire une seule fois, manuellement) :
--   1. Créez un compte normal sur Captivo (client ou photographe, peu importe)
--   2. Dans Supabase > Authentication > Users, repérez votre compte et copiez son "UID"
--   3. Dans Supabase > Table Editor > admins, ajoutez une ligne avec ce user_id
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  created_at timestamp with time zone default now()
);
alter table admins enable row level security;
create policy "Un utilisateur peut vérifier s'il est admin" on admins
  for select using (auth.uid() = user_id);

-- Fonction utilitaire réutilisée par les politiques ci-dessous
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql security definer stable;

-- ============================================
-- Mise à jour de la protection anti-triche : on autorise maintenant
-- soit service_role (Table Editor), soit un vrai admin reconnu par la table admins.
-- ============================================
create or replace function protect_verification_status()
returns trigger as $$
begin
  if NEW.verification_status is distinct from OLD.verification_status then
    if auth.role() <> 'service_role' and not is_admin() then
      if NEW.verification_status not in ('pending') then
        NEW.verification_status := OLD.verification_status;
      end if;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Un admin peut modifier n'importe quelle fiche photographe (pour approuver/refuser)
create policy "Admin modifie n'importe quel profil" on photographers
  for update using (is_admin());

-- Un admin peut consulter et supprimer n'importe quel avis (modération)
create policy "Admin gère les avis" on reviews
  for all using (is_admin());

-- Un admin peut consulter les justificatifs d'identité de tous les photographes
create policy "Admin consulte tous les justificatifs" on storage.objects
  for select using (bucket_id = 'verification-docs' and is_admin());
