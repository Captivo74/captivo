-- ============================================
-- CAPTIVO — Rattrapage : la protection anti-triche bloque aussi l'admin
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- S'assure que la fonction is_admin() existe bien (sans erreur si déjà là)
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql security definer stable;

-- Remplace la protection anti-triche pour qu'elle autorise un vrai admin
-- (reconnu via la table admins), en plus de l'accès service_role.
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

-- S'assure que la règle qui permet à l'admin de modifier n'importe quelle
-- fiche photographe (pour approuver/refuser) existe bien
drop policy if exists "Admin modifie n'importe quel profil" on photographers;
create policy "Admin modifie n'importe quel profil" on photographers
  for update using (is_admin());
