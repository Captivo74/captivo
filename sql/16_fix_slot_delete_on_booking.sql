-- ============================================
-- CAPTIVO — Correctif : un créneau réservé doit disparaître pour tout le monde
-- La règle actuelle n'autorisait que le photographe à supprimer SES créneaux,
-- alors que c'est le CLIENT qui doit en supprimer un au moment de réserver.
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

drop policy if exists "Un client supprime un créneau qu'il réserve" on slots;
create policy "Un client supprime un créneau qu'il réserve" on slots
  for delete using (auth.uid() is not null);
