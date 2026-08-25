-- ============================================
-- CAPTIVO — Mise à jour n°5 : bannissement, gestion des admins, emails photographes
-- À coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter APRÈS les scripts 01 à 04)
-- ============================================

-- ============================================
-- Bannissement de comptes (client ou photographe)
-- ============================================
create table if not exists banned_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  reason text not null,
  banned_at timestamp with time zone default now(),
  banned_by uuid references auth.users(id)
);
alter table banned_users enable row level security;

-- un utilisateur banni doit pouvoir lire SON PROPRE motif (pour lui afficher le popup)
create policy "Un utilisateur voit son propre statut de bannissement" on banned_users
  for select using (auth.uid() = user_id);
create policy "Admin voit tous les bannissements" on banned_users
  for select using (is_admin());
create policy "Admin bannit un utilisateur" on banned_users
  for insert with check (is_admin());
create policy "Admin débannit un utilisateur" on banned_users
  for delete using (is_admin());
create policy "Admin modifie un motif de bannissement" on banned_users
  for update using (is_admin());

-- ============================================
-- Gestion complète des admins (ajout / retrait / consultation)
-- ============================================
create policy "Admin voit tous les admins" on admins
  for select using (is_admin());
create policy "Admin ajoute un autre admin" on admins
  for insert with check (is_admin());
create policy "Admin retire un admin" on admins
  for delete using (is_admin());

-- ============================================
-- Email des photographes, VISIBLE UNIQUEMENT PAR LES ADMINS
-- (jamais public, contrairement au reste du profil photographe)
-- ============================================
create table if not exists photographer_emails (
  photographer_id uuid primary key references photographers(id) on delete cascade,
  email text not null
);
alter table photographer_emails enable row level security;
create policy "Photographe enregistre son propre email" on photographer_emails
  for insert with check (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );
create policy "Admin consulte les emails des photographes" on photographer_emails
  for select using (is_admin());
