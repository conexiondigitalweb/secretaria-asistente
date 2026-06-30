-- ============================================================
-- Fix: permisos y RLS de gmail_tokens
--
-- Problema: faltaba GRANT a authenticated (RLS y GRANT son capas
-- independientes en PostgreSQL — sin GRANT el rol no llega a RLS).
-- Además la política FOR ALL con USING no aplica a INSERT.
-- ============================================================

-- 1. GRANT explícito al rol authenticated
grant select, insert, update, delete on table gmail_tokens to authenticated;

-- 2. Eliminar la política genérica anterior y reemplazar por políticas
--    separadas por operación para mayor claridad y corrección

drop policy if exists "gmail_tokens_own" on gmail_tokens;

-- SELECT: solo ve sus propios tokens
create policy "gmail_tokens_select"
  on gmail_tokens
  for select
  to authenticated
  using (usuario_email = auth.jwt() ->> 'email');

-- INSERT: solo puede insertar con su propio email
create policy "gmail_tokens_insert"
  on gmail_tokens
  for insert
  to authenticated
  with check (usuario_email = auth.jwt() ->> 'email');

-- UPDATE: solo puede modificar sus propios tokens
create policy "gmail_tokens_update"
  on gmail_tokens
  for update
  to authenticated
  using  (usuario_email = auth.jwt() ->> 'email')
  with check (usuario_email = auth.jwt() ->> 'email');

-- DELETE: solo puede borrar sus propios tokens
create policy "gmail_tokens_delete"
  on gmail_tokens
  for delete
  to authenticated
  using (usuario_email = auth.jwt() ->> 'email');
