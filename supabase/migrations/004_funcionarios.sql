-- ============================================================
-- SecretaríaOS — Tabla funcionarios + delegado en eventos
-- ============================================================

create table if not exists funcionarios (
  id         uuid primary key default uuid_generate_v4(),
  nombre     text not null,
  cargo      text not null,
  tipo       text not null default 'planta' check (tipo in ('planta','contratista')),
  correo     text,
  telefono   text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists funcionarios_activo_idx on funcionarios(activo);

-- RLS
alter table funcionarios enable row level security;

create policy "autenticado_todo_funcionarios"
  on funcionarios for all
  to authenticated
  using (true)
  with check (true);

-- Grants
grant select, insert, update, delete on funcionarios to authenticated, anon;

-- Delegado en eventos_agenda: FK a funcionarios (opcional)
alter table eventos_agenda
  add column if not exists delegado_id uuid references funcionarios(id) on delete set null;

create index if not exists eventos_delegado_idx on eventos_agenda(delegado_id);
