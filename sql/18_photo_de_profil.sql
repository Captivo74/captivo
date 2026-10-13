-- ============================================
-- CAPTIVO — Photo de profil des photographes
-- À coller dans Supabase > SQL Editor > New query > Run
-- (les photos sont stockées dans le bucket "portfolios" déjà existant)
-- ============================================
alter table photographers add column if not exists avatar_url text;
