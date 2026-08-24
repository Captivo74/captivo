-- ============================================
-- CAPTIVO — Recréer les règles de sécurité du bucket verification-docs
-- (le bucket a été créé manuellement, ces règles n'existaient peut-être pas encore)
-- À coller dans Supabase > SQL Editor > New query > Run
-- ============================================

drop policy if exists "Photographe upload son propre justificatif" on storage.objects;
create policy "Photographe upload son propre justificatif" on storage.objects
  for insert with check (bucket_id = 'verification-docs' and auth.uid() is not null);

drop policy if exists "Photographe voit son propre justificatif" on storage.objects;
create policy "Photographe voit son propre justificatif" on storage.objects
  for select using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = (select id::text from photographers where user_id = auth.uid())
  );
