-- ============================================================
-- SecretaríaOS — WhatsApp en funcionarios + funcionario_id en tareas
-- ============================================================

-- Campo WhatsApp opcional en funcionarios
alter table funcionarios
  add column if not exists whatsapp text;

-- Asignación de funcionario en tareas (distinto de asignado_a que es FK a auth.users)
alter table tareas
  add column if not exists funcionario_id uuid references funcionarios(id) on delete set null;

create index if not exists tareas_funcionario_idx on tareas(funcionario_id);
