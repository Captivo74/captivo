-- ============================================
-- CAPTIVO — Mise en place de la base de données
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

-- Table des photographes (profil public)
create table photographers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  name text not null,
  city text default 'Ville non renseignée',
  style text default 'Portrait',
  rate text default 'À définir',
  rating numeric default 5.0,
  bio text default 'Nouveau photographe sur Captivo.',
  initials text,
  color text,
  created_at timestamp with time zone default now()
);

-- Table des créneaux disponibles
create table slots (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  label text not null,
  created_at timestamp with time zone default now()
);

-- Table des demandes de réservation
create table booking_requests (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  client_name text,
  client_email text,
  style text,
  slot_label text,
  status text default 'pending', -- pending | confirmed | declined
  decline_reason text,
  client_notified boolean default true,
  created_at timestamp with time zone default now()
);

-- Table des messages de contact (quand aucun créneau ne convient)
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  name text,
  email text,
  phone text,
  style text,
  date_wanted text,
  message text,
  read boolean default false,
  created_at timestamp with time zone default now()
);

-- ============================================
-- Sécurité (Row Level Security) — active la protection par ligne
-- ============================================
alter table photographers enable row level security;
alter table slots enable row level security;
alter table booking_requests enable row level security;
alter table contact_messages enable row level security;

-- Tout le monde peut LIRE les profils photographes et créneaux (annuaire public)
create policy "Photographes visibles par tous" on photographers for select using (true);
create policy "Créneaux visibles par tous" on slots for select using (true);

-- Seul le photographe propriétaire peut modifier SON profil
create policy "Photographe modifie son propre profil" on photographers
  for update using (auth.uid() = user_id);
create policy "Photographe crée son propre profil" on photographers
  for insert with check (auth.uid() = user_id);

-- Seul le photographe propriétaire gère SES créneaux
create policy "Photographe gère ses créneaux" on slots
  for all using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );

-- Les demandes : visibles par le client concerné OU le photographe concerné
create policy "Client voit ses demandes" on booking_requests
  for select using (auth.uid() = client_id);
create policy "Photographe voit ses demandes" on booking_requests
  for select using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );
create policy "Client crée une demande" on booking_requests
  for insert with check (auth.uid() = client_id);
create policy "Photographe met à jour ses demandes" on booking_requests
  for update using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );

-- Les messages de contact : visibles par le photographe concerné
create policy "Photographe voit ses messages" on contact_messages
  for select using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );
create policy "Tout le monde peut envoyer un message" on contact_messages
  for insert with check (true);
create policy "Photographe marque ses messages comme lus" on contact_messages
  for update using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );
