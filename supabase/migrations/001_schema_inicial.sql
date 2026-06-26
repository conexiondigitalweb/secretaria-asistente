-- ============================================================
-- SecretaríaOS — Schema inicial
-- Secretaría de Educación, Cultura y Turismo — Ocaña, N. de S.
-- ============================================================

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ============================================================
-- TABLA: tareas
-- Gestiona solicitudes, peticiones, tutelas y tareas del despacho
-- ============================================================
create table if not exists tareas (
  id              uuid primary key default uuid_generate_v4(),
  tipo            text not null check (tipo in ('tutela','peticion','queja','solicitud','reunion','tarea','otro')),
  origen          text not null default 'fisico' check (origen in ('correo','fisico','verbal','whatsapp','otro')),
  asunto          text not null,
  descripcion     text,
  remitente       text,
  fecha_recibido  timestamptz not null default now(),
  fecha_limite    timestamptz,
  estado          text not null default 'pendiente' check (estado in ('pendiente','en_proceso','resuelto','vencido')),
  prioridad       text not null default 'media' check (prioridad in ('critica','alta','media','baja')),
  asignado_a      uuid references auth.users(id) on delete set null,
  borrador_ia     text,
  respuesta_final text,
  correo_id       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Índices útiles para filtros frecuentes
create index if not exists tareas_estado_idx      on tareas(estado);
create index if not exists tareas_tipo_idx        on tareas(tipo);
create index if not exists tareas_fecha_limite_idx on tareas(fecha_limite);
create index if not exists tareas_prioridad_idx   on tareas(prioridad);

-- Trigger: actualizar updated_at automáticamente
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tareas_updated_at on tareas;
create trigger tareas_updated_at
  before update on tareas
  for each row execute function set_updated_at();

-- ============================================================
-- TABLA: eventos_agenda
-- ============================================================
create table if not exists eventos_agenda (
  id              uuid primary key default uuid_generate_v4(),
  titulo          text not null,
  descripcion     text,
  fecha_inicio    timestamptz not null,
  fecha_fin       timestamptz,
  tipo            text not null default 'evento' check (tipo in ('reunion','compromiso','recordatorio','evento')),
  lugar           text,
  participantes   text[],
  tarea_id        uuid references tareas(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists eventos_fecha_inicio_idx on eventos_agenda(fecha_inicio);

-- ============================================================
-- TABLA: documentos
-- ============================================================
create table if not exists documentos (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  tipo        text not null default 'otro' check (tipo in ('plan_desarrollo','plan_accion','normativa','informe','otro')),
  descripcion text,
  archivo_url text,
  embedding   vector(1536),
  vigente     boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists documentos_vigente_idx on documentos(vigente);

-- ============================================================
-- TABLA: notificaciones
-- ============================================================
create table if not exists notificaciones (
  id          uuid primary key default uuid_generate_v4(),
  tarea_id    uuid references tareas(id) on delete cascade,
  tipo        text not null check (tipo in ('vencimiento_3d','vencimiento_1d','vencimiento_hoy','nueva_tarea')),
  enviada     boolean not null default false,
  fecha_envio timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notificaciones_enviada_idx on notificaciones(enviada);

-- ============================================================
-- RLS (Row Level Security) — habilitar en todas las tablas
-- Por ahora permisivo: autenticado puede todo (refinar por rol en Fase 2)
-- ============================================================
alter table tareas          enable row level security;
alter table eventos_agenda  enable row level security;
alter table documentos      enable row level security;
alter table notificaciones  enable row level security;

-- Política temporal: usuario autenticado tiene acceso total
create policy "autenticado_todo_tareas"
  on tareas for all
  to authenticated
  using (true)
  with check (true);

create policy "autenticado_todo_eventos"
  on eventos_agenda for all
  to authenticated
  using (true)
  with check (true);

create policy "autenticado_todo_documentos"
  on documentos for all
  to authenticated
  using (true)
  with check (true);

create policy "autenticado_todo_notificaciones"
  on notificaciones for all
  to authenticated
  using (true)
  with check (true);
