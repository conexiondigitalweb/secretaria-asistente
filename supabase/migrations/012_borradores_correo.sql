-- ============================================================
-- SecretaríaOS — Tabla borradores_correo
--
-- Cada correo nuevo leído por gmail-sync se guarda aquí como
-- borrador pendiente de aprobación. Nunca se crea una tarea
-- o evento real sin confirmación explícita del secretario.
-- ============================================================

create table if not exists borradores_correo (
  id                uuid        primary key default uuid_generate_v4(),
  gmail_message_id  text        not null unique,  -- evita reprocesar el mismo correo
  usuario_email     text        not null,
  remitente         text,
  asunto            text,
  cuerpo_resumen    text,       -- resumen ≤200 chars generado por Claude
  clasificacion     text        not null
    check (clasificacion in ('tutela','peticion','queja','convocatoria','informativo','spam')),
  confianza         numeric(4,3)
    check (confianza >= 0 and confianza <= 1),
  datos_extraidos   jsonb       not null default '{}',
  -- Shape de datos_extraidos:
  -- { numero_radicado, fecha_limite, lugar, fecha_hora_reunion, es_duplicado }
  estado            text        not null default 'pendiente'
    check (estado in ('pendiente','aprobado','rechazado')),
  tarea_id          uuid        references tareas(id) on delete set null,
  evento_id         uuid        references eventos_agenda(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- Índices
create index if not exists borradores_usuario_email_idx on borradores_correo(usuario_email);
create index if not exists borradores_estado_idx        on borradores_correo(estado);
create index if not exists borradores_clasificacion_idx on borradores_correo(clasificacion);

-- ── RLS ──────────────────────────────────────────────────────
alter table borradores_correo enable row level security;

-- Políticas separadas por operación (lección aprendida — migración 009)
create policy "borradores_select"
  on borradores_correo for select
  to authenticated
  using (usuario_email = auth.jwt() ->> 'email');

create policy "borradores_insert"
  on borradores_correo for insert
  to authenticated
  with check (usuario_email = auth.jwt() ->> 'email');

create policy "borradores_update"
  on borradores_correo for update
  to authenticated
  using  (usuario_email = auth.jwt() ->> 'email')
  with check (usuario_email = auth.jwt() ->> 'email');

-- ── GRANTs ───────────────────────────────────────────────────
-- Ambos roles desde el inicio (no repetir bug de migración 009)
grant select, insert, update, delete on table borradores_correo to authenticated;
grant select, insert, update, delete on table borradores_correo to service_role;

-- service_role necesita leer tareas para verificar duplicados de radicado
-- (gmail-sync.js corre con service_role client)
-- y escribir en tareas/eventos_agenda si en el futuro se aprueba desde serverless
grant select, insert, update, delete on table tareas          to service_role;
grant select, insert, update, delete on table eventos_agenda  to service_role;
