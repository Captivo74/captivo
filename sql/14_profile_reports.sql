-- ============================================
-- CAPTIVO — Signalement de profils photographes
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

create table if not exists profile_reports (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  photographer_name text,
  reason text not null,
  description text,
  reporter_email text,
  status text not null default 'new', -- 'new' | 'reviewed'
  created_at timestamp with time zone default now()
);

alter table profile_reports enable row level security;

-- N'importe qui (même non connecté) peut signaler un profil
create policy "Tout le monde peut signaler un profil" on profile_reports
  for insert with check (true);

-- Seul un admin peut consulter et modifier les signalements
create policy "Admin consulte les signalements" on profile_reports
  for select using (is_admin());

create policy "Admin modifie le statut des signalements" on profile_reports
  for update using (is_admin());

create policy "Admin supprime un signalement traité" on profile_reports
  for delete using (is_admin());
