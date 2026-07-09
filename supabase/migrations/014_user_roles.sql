-- ============================================================
-- SecretaríaOS — Roles y permisos (user_profiles)
--
-- Introduce roles 'admin' y 'agenda' sobre Supabase Auth.
-- Reemplaza las políticas RLS abiertas ("autenticado puede todo")
-- de tareas y eventos_agenda por control basado en get_user_role().
-- ============================================================

create table if not exists user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('admin','agenda')),
  display_name text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table user_profiles enable row level security;

-- ── Función: rol del usuario autenticado ──────────────────────
-- security definer + search_path fijo: evita que RLS de user_profiles
-- bloquee su propia lectura al usarla dentro de otras políticas.
create or replace function get_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from user_profiles
  where id = auth.uid() and active = true;
$$;

grant execute on function get_user_role() to authenticated;

-- ── Seed: cuenta actual del secretario como admin ─────────────
insert into user_profiles (id, role, display_name)
select id, 'admin', 'Secretario'
from auth.users
where email = 'sectocana@gmail.com'
on conflict (id) do nothing;

-- ── RLS: user_profiles ────────────────────────────────────────
create policy "user_profiles_select"
  on user_profiles for select
  to authenticated
  using (id = auth.uid() or get_user_role() = 'admin');

create policy "user_profiles_insert_admin"
  on user_profiles for insert
  to authenticated
  with check (get_user_role() = 'admin');

create policy "user_profiles_update_admin"
  on user_profiles for update
  to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "user_profiles_delete_admin"
  on user_profiles for delete
  to authenticated
  using (get_user_role() = 'admin');

grant select, insert, update, delete on user_profiles to authenticated;
grant select, insert, update, delete on user_profiles to service_role;

-- ── RLS: tareas — solo admin ──────────────────────────────────
drop policy if exists "autenticado_todo_tareas" on tareas;

create policy "tareas_select_admin"
  on tareas for select to authenticated
  using (get_user_role() = 'admin');

create policy "tareas_insert_admin"
  on tareas for insert to authenticated
  with check (get_user_role() = 'admin');

create policy "tareas_update_admin"
  on tareas for update to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');

create policy "tareas_delete_admin"
  on tareas for delete to authenticated
  using (get_user_role() = 'admin');

-- ── RLS: eventos_agenda — admin y agenda ──────────────────────
drop policy if exists "autenticado_todo_eventos" on eventos_agenda;

create policy "eventos_select_admin_agenda"
  on eventos_agenda for select to authenticated
  using (get_user_role() in ('admin','agenda'));

create policy "eventos_insert_admin_agenda"
  on eventos_agenda for insert to authenticated
  with check (get_user_role() in ('admin','agenda'));

create policy "eventos_update_admin_agenda"
  on eventos_agenda for update to authenticated
  using (get_user_role() in ('admin','agenda'))
  with check (get_user_role() in ('admin','agenda'));

-- ── RLS: borradores_correo — solo admin (reemplaza filtro por email) ──
drop policy if exists "borradores_select" on borradores_correo;
drop policy if exists "borradores_insert" on borradores_correo;
drop policy if exists "borradores_update" on borradores_correo;

create policy "borradores_select_admin"
  on borradores_correo for select to authenticated
  using (get_user_role() = 'admin');

create policy "borradores_update_admin"
  on borradores_correo for update to authenticated
  using (get_user_role() = 'admin')
  with check (get_user_role() = 'admin');
-- INSERT sigue reservado a service_role (gmail-sync.js) — no se otorga a authenticated.
