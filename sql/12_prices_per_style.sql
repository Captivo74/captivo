-- ============================================
-- CAPTIVO — Tarifs par style de photographie
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- Stocke un tarif différent pour chaque style proposé, ex. {"Mariage": "800€", "Portrait": "120€"}
alter table photographers add column if not exists prices jsonb default '{}'::jsonb;
