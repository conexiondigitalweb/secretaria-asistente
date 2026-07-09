-- Migración 013 — columna calendar_event_id en eventos_agenda
-- Almacena el ID del evento en Google Calendar para sincronización bidireccional.
-- Columna nullable: eventos creados antes de la integración no tienen Calendar ID.

ALTER TABLE eventos_agenda
  ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Índice para búsqueda por calendar_event_id (deduplicación en Agenda.jsx)
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_calendar_event_id
  ON eventos_agenda (calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

-- GRANT: service_role necesita acceso para cualquier función serverless futura
-- (sigue el patrón de migración 011)
GRANT SELECT, INSERT, UPDATE, DELETE ON eventos_agenda TO service_role;
