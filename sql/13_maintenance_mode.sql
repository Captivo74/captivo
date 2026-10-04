-- ============================================
-- CAPTIVO — Mode maintenance
-- Une seule ligne de réglages, modifiable depuis le panel admin.
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

create table if not exists site_settings (
  id int primary key default 1,
  maintenance_mode boolean not null default false,
  maintenance_message text default 'Captivo est actuellement en maintenance. Nous revenons très vite !',
  updated_at timestamp with time zone default now(),
  constraint single_row check (id = 1)
);

-- La ligne unique de réglages existe toujours, dès le départ
insert into site_settings (id, maintenance_mode) values (1, false)
on conflict (id) do nothing;

alter table site_settings enable row level security;

-- Tout le monde doit pouvoir lire ce réglage (c'est justement ce qui bloque ou non les visiteurs)
create policy "Tout le monde peut lire le mode maintenance" on site_settings
  for select using (true);

-- Seul un admin peut changer le réglage
create policy "Admin modifie le mode maintenance" on site_settings
  for update using (is_admin());
