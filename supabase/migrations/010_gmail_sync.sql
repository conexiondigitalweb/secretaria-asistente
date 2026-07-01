-- ============================================================
-- SecretaríaOS — Fase 3: historial de sincronización Gmail
-- ============================================================

create table if not exists gmail_sync (
  id              uuid primary key default gen_random_uuid(),
  usuario_email   text not null unique,
  history_id      text,           -- último historyId procesado de Gmail
  last_sync_at    timestamptz,    -- cuándo se hizo la última sync
  emails_procesados int default 0, -- contador acumulado
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create trigger gmail_sync_updated_at
  before update on gmail_sync
  for each row execute function set_updated_at();   -- función ya existe de migración 008

-- RLS: cada usuario solo ve su propio registro
alter table gmail_sync enable row level security;

create policy "gmail_sync_select"
  on gmail_sync for select
  to authenticated
  using (usuario_email = auth.jwt() ->> 'email');

create policy "gmail_sync_insert"
  on gmail_sync for insert
  to authenticated
  with check (usuario_email = auth.jwt() ->> 'email');

create policy "gmail_sync_update"
  on gmail_sync for update
  to authenticated
  using  (usuario_email = auth.jwt() ->> 'email')
  with check (usuario_email = auth.jwt() ->> 'email');

grant select, insert, update on table gmail_sync to authenticated;

-- Columna para marcar tareas creadas desde correo (ya existe correo_id en tareas,
-- pero añadimos índice para filtrado rápido)
create index if not exists tareas_correo_id_idx on tareas(correo_id)
  where correo_id is not null;
