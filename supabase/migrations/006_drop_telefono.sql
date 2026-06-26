-- ============================================================
-- SecretaríaOS — Eliminar columna telefono de funcionarios
-- WhatsApp cumple ambas funciones
-- ============================================================

alter table funcionarios drop column if exists telefono;
