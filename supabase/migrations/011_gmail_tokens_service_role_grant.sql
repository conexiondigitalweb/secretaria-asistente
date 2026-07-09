-- ============================================================
-- Fix: GRANT a service_role en gmail_tokens y gmail_sync
-- El service_role necesita privilegios explícitos aunque
-- tenga BYPASSRLS — son dos capas independientes en PostgreSQL.
-- ============================================================

grant select, insert, update, delete on table gmail_tokens to service_role;
grant select, insert, update, delete on table gmail_sync    to service_role;
