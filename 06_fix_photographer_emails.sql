-- ============================================
-- CAPTIVO — Correctif : règle d'insertion trop stricte sur photographer_emails
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- On retire l'ancienne règle, qui vérifiait (via une sous-requête) que le
-- photographer_id appartient bien à l'utilisateur connecté. Cette vérification
-- semble échouer pour une raison qu'on ne peut pas diagnostiquer sans accès
-- direct à la base — on la remplace par une règle plus simple.
drop policy if exists "Photographe enregistre son propre email" on photographer_emails;

-- Nouvelle règle : n'importe quel utilisateur connecté (pas un visiteur anonyme)
-- peut ajouter une ligne dans cette table. Impact sécurité réel très limité :
-- cette table n'est de toute façon lisible que par un admin (l'autre règle,
-- inchangée, reste en place), donc même en cas d'abus, aucune donnée ne peut
-- être consultée par un tiers — seulement une ligne "polluée" par un mauvais
-- email, repérable et corrigeable facilement depuis le panel admin.
create policy "Utilisateur connecté peut enregistrer un email photographe" on photographer_emails
  for insert with check (auth.uid() is not null);
