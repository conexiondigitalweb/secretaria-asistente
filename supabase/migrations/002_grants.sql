-- ============================================================
-- SecretaríaOS — Grants de permisos a roles Supabase
-- Ejecutar después de 001_schema_inicial.sql
--
-- Causa del error "permission denied for table tareas":
-- Las tablas creadas por SQL directo NO reciben GRANT automático.
-- RLS y GRANT son capas independientes: sin GRANT, PostgreSQL
-- rechaza la consulta antes de evaluar las políticas RLS.
-- ============================================================

-- Permisos sobre tablas
grant select, insert, update, delete on tareas          to authenticated, anon;
grant select, insert, update, delete on eventos_agenda  to authenticated, anon;
grant select, insert, update, delete on documentos      to authenticated, anon;
grant select, insert, update, delete on notificaciones  to authenticated, anon;

-- Permisos sobre secuencias (necesario para INSERT con uuid_generate_v4)
grant usage, select on all sequences in schema public to authenticated, anon;
