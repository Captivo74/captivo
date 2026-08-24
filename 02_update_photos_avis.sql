-- ============================================
-- CAPTIVO — Mise à jour n°2 : photos, avis, annulation
-- À coller dans Supabase > SQL Editor > New query > Run
-- (à exécuter APRÈS le premier script captivo_supabase_setup.sql)
-- ============================================

-- Table des photos de portfolio
create table photographer_photos (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid references photographers(id) on delete cascade,
  url text not null,
  created_at timestamp with time zone default now()
);
alter table photographer_photos enable row level security;
create policy "Photos visibles par tous" on photographer_photos for select using (true);
create policy "Photographe gère ses photos" on photographer_photos
  for all using (
    photographer_id in (select id from photographers where user_id = auth.uid())
  );

-- Table des avis clients
create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid references booking_requests(id) on delete cascade unique,
  photographer_id uuid references photographers(id) on delete cascade,
  client_id uuid references auth.users(id) on delete cascade,
  client_name text,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamp with time zone default now()
);
alter table reviews enable row level security;
create policy "Avis visibles par tous" on reviews for select using (true);
create policy "Client laisse un avis sur sa propre réservation" on reviews
  for insert with check (auth.uid() = client_id);

-- Bucket de stockage pour les photos de portfolio (public en lecture)
insert into storage.buckets (id, name, public)
values ('portfolios', 'portfolios', true)
on conflict (id) do nothing;

create policy "Lecture publique des photos" on storage.objects
  for select using (bucket_id = 'portfolios');
create policy "Photographe upload ses photos" on storage.objects
  for insert with check (bucket_id = 'portfolios' and auth.uid() is not null);
create policy "Photographe supprime ses photos" on storage.objects
  for delete using (bucket_id = 'portfolios' and auth.uid() is not null);
