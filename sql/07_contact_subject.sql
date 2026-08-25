-- ============================================
-- CAPTIVO — Ajout d'un champ "sujet" pour les messages de contact
-- Permet de distinguer les messages destinés à un photographe (photographer_id rempli)
-- des messages destinés au support Captivo (photographer_id = NULL)
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

alter table contact_messages add column if not exists subject text;

-- Permet à un admin de consulter les messages envoyés au support Captivo
-- (ceux qui n'ont pas de photographe destinataire précis)
create policy "Admin consulte les messages de support" on contact_messages
  for select using (is_admin());
