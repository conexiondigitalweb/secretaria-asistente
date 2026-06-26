-- ============================================================
-- SecretaríaOS — Radicado en tutelas + deduplicación
-- ============================================================

-- Columna radicado: identificador único del expediente judicial
alter table tareas
  add column if not exists radicado text;

-- Índice único PARCIAL: solo aplica a tutelas con radicado no nulo.
-- Permite radicado = null en cualquier tipo, y duplicados en otros tipos,
-- pero impide dos tutelas con el mismo número de radicado.
create unique index if not exists tutelas_radicado_unique
  on tareas (radicado)
  where tipo = 'tutela' and radicado is not null;

-- Índice de búsqueda rápida por radicado
create index if not exists tareas_radicado_idx
  on tareas (radicado)
  where radicado is not null;
