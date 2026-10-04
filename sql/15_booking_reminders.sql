-- ============================================
-- CAPTIVO — Rappel automatique la veille d'un rendez-vous
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- Une vraie date, en plus du texte affiché (qui, lui, ne change pas)
alter table slots add column if not exists slot_date date;
alter table booking_requests add column if not exists slot_date date;
alter table booking_requests add column if not exists reminder_sent boolean not null default false;

-- Active les extensions nécessaires pour programmer une tâche quotidienne
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supprime une éventuelle tâche du même nom avant de la recréer (pour pouvoir
-- relancer ce script sans erreur si besoin)
select cron.unschedule('captivo-rappels-quotidiens')
where exists (select 1 from cron.job where jobname = 'captivo-rappels-quotidiens');

-- Programme l'envoi des rappels tous les jours à 18h00 (heure du serveur, UTC)
select cron.schedule(
  'captivo-rappels-quotidiens',
  '0 18 * * *',
  $$
  select net.http_post(
    url := 'https://pieyxpbfjjpshzyevdxu.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_Dmpuq5e7RcVHxg_A7T5p6w_gdetzdd4"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
