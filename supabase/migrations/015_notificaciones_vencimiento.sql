-- ============================================================
-- SecretaríaOS — Notificaciones automáticas de vencimiento
--
-- Contexto (ver diagnóstico en el commit / PR):
--   1. pg_cron y pg_net NO están habilitados todavía en este proyecto
--      (no hay referencias previas en migraciones ni en el código).
--      El SQL para habilitarlos y crear el job se entrega POR SEPARADO
--      (fuera de esta migración) para que el secretario lo ejecute a
--      mano en el SQL Editor de Supabase — no se ejecuta desde aquí.
--   2. La tabla `notificaciones` ya existía desde 001_schema_inicial.sql
--      pero sin `destinatario_email` ni índice de deduplicación — se
--      ajusta aquí en vez de recrearla.
--   3. `funcionarios.correo` (text, nullable) es el campo de email del
--      funcionario asignado a una tarea (tareas.funcionario_id → FK).
--   4. api/send-email.js solo acepta un destinatario por llamada
--      (`to` string, no array) — el endpoint de envío debe iterar una
--      vez por notificación/destinatario.
-- ============================================================

-- ── 1. Ajustes a la tabla notificaciones existente ────────────────────────

alter table notificaciones
  add column if not exists destinatario_email text;

-- Solo forzar NOT NULL si no hay filas legacy con el campo nulo
-- (la tabla nunca se usó en producción, pero esto la deja segura para re-runs).
do $$
begin
  if not exists (select 1 from notificaciones where destinatario_email is null) then
    alter table notificaciones alter column destinatario_email set not null;
  end if;
end $$;

-- Deduplicación: una misma notificación (tarea + tipo + destinatario)
-- nunca se genera ni se envía dos veces.
create unique index if not exists notificaciones_dedupe_idx
  on notificaciones (tarea_id, tipo, destinatario_email);

create index if not exists notificaciones_enviada_idx on notificaciones(enviada);

-- ── 2. RLS de notificaciones — reemplaza la política abierta original ─────
-- Solo lectura para admin. Las escrituras las hace la función SECURITY
-- DEFINER (generar_notificaciones_vencimiento) y el endpoint serverless
-- con service_role — nunca directamente el cliente autenticado.

drop policy if exists "autenticado_todo_notificaciones" on notificaciones;

create policy "notificaciones_select_admin"
  on notificaciones for select
  to authenticated
  using (get_user_role() = 'admin');

grant select on notificaciones to authenticated;
grant select, insert, update, delete on notificaciones to service_role;

-- ============================================================
-- 3. Calendario de festivos colombianos (para calcular días hábiles en SQL)
--
-- Refleja la misma fuente que usa el frontend (paquete npm
-- `colombia-holiday`, ver src/lib/utils.js). Postgres no puede ejecutar
-- ese paquete, así que se precalculan y se insertan las fechas reales
-- de celebración (ya ajustadas por la Ley Emiliani) para 2026-2028.
--
-- ⚠️ MANTENIMIENTO: agregar los festivos del año siguiente antes de que
-- termine cada año (correr el mismo script de generación y adjuntar una
-- migración nueva con los INSERT — no modificar esta tabla a mano en Prod
-- sin dejar registro en el repo).
-- ============================================================

create table if not exists festivos_colombia (
  fecha date primary key
);

insert into festivos_colombia (fecha) values
  -- 2026
  ('2026-01-01'), ('2026-01-12'), ('2026-03-23'), ('2026-04-02'), ('2026-04-03'),
  ('2026-05-01'), ('2026-05-18'), ('2026-06-08'), ('2026-06-15'), ('2026-06-29'),
  ('2026-07-20'), ('2026-08-07'), ('2026-08-17'), ('2026-10-12'), ('2026-11-02'),
  ('2026-11-16'), ('2026-12-08'), ('2026-12-25'),
  -- 2027
  ('2027-01-01'), ('2027-01-11'), ('2027-03-22'), ('2027-03-25'), ('2027-03-26'),
  ('2027-05-01'), ('2027-05-10'), ('2027-05-31'), ('2027-06-07'), ('2027-07-05'),
  ('2027-07-20'), ('2027-08-07'), ('2027-08-16'), ('2027-10-18'), ('2027-11-01'),
  ('2027-11-15'), ('2027-12-08'), ('2027-12-25'),
  -- 2028
  ('2028-01-01'), ('2028-01-10'), ('2028-03-20'), ('2028-04-13'), ('2028-04-14'),
  ('2028-05-01'), ('2028-05-29'), ('2028-06-19'), ('2028-06-26'), ('2028-07-03'),
  ('2028-07-20'), ('2028-08-07'), ('2028-08-21'), ('2028-10-16'), ('2028-11-06'),
  ('2028-11-13'), ('2028-12-08'), ('2028-12-25')
on conflict (fecha) do nothing;

grant select on festivos_colombia to authenticated, service_role;

-- ── 4. Funciones de días hábiles (equivalente SQL de lib/utils.js) ────────

create or replace function es_dia_habil(p_fecha date)
returns boolean
language sql
stable
as $$
  select extract(dow from p_fecha) not in (0, 6)  -- domingo=0, sábado=6
     and not exists (select 1 from festivos_colombia f where f.fecha = p_fecha);
$$;

-- Días hábiles restantes hasta p_fecha_limite, relativo a p_hoy (por defecto
-- "hoy" en hora de Colombia). Espejo de diasHabilesRestantes() en utils.js:
-- 0 si vence hoy, negativo si ya venció, null si no hay fecha límite.
create or replace function dias_habiles_restantes(p_fecha_limite date, p_hoy date default (now() at time zone 'America/Bogota')::date)
returns int
language plpgsql
stable
as $$
declare
  v_signo  int;
  v_desde  date;
  v_hasta  date;
  v_cursor date;
  v_count  int := 0;
begin
  if p_fecha_limite is null then
    return null;
  end if;

  if p_fecha_limite = p_hoy then
    return 0;
  end if;

  if p_fecha_limite > p_hoy then
    v_signo := 1;  v_desde := p_hoy;         v_hasta := p_fecha_limite;
  else
    v_signo := -1; v_desde := p_fecha_limite; v_hasta := p_hoy;
  end if;

  v_cursor := v_desde;
  while v_cursor < v_hasta loop
    v_cursor := v_cursor + 1;
    if es_dia_habil(v_cursor) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_signo * v_count;
end;
$$;

-- ── 5. Generación de notificaciones de vencimiento (idempotente) ─────────
--
-- Reglas (pedidas explícitamente):
--   - Solo tareas 'pendiente' o 'en_proceso' — NUNCA 'resuelto' (ni 'vencido').
--     Si una tarea se resuelve entre la notificación de 3 días y la de hoy,
--     la de hoy no se genera porque el estado ya no matchea el filtro.
--   - Dos destinatarios por tarea que aplica: el admin activo (rol 'admin'
--     en user_profiles) y el funcionario asignado (funcionarios.correo), si
--     existen. Los usuarios con rol 'agenda' nunca están en ninguna de las
--     dos fuentes, así que nunca reciben estas notificaciones.
--   - on conflict do nothing sobre notificaciones_dedupe_idx: idempotente,
--     se puede correr el job las veces que sea sin duplicar filas.
create or replace function generar_notificaciones_vencimiento()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy         date := (now() at time zone 'America/Bogota')::date;
  v_admin_email text;
  v_insertadas  int := 0;
  v_rows        int;
  r             record;
begin
  select u.email into v_admin_email
  from user_profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin' and p.active = true
  order by p.created_at asc
  limit 1;

  for r in
    select
      t.id as tarea_id,
      f.correo as funcionario_email,
      case
        when (t.fecha_limite at time zone 'America/Bogota')::date = v_hoy then 'vencimiento_hoy'
        when dias_habiles_restantes((t.fecha_limite at time zone 'America/Bogota')::date, v_hoy) = 3 then 'vencimiento_3d'
        else null
      end as tipo_notif
    from tareas t
    left join funcionarios f on f.id = t.funcionario_id
    where t.estado in ('pendiente', 'en_proceso')
      and t.fecha_limite is not null
  loop
    if r.tipo_notif is null then
      continue;
    end if;

    if v_admin_email is not null then
      insert into notificaciones (tarea_id, tipo, destinatario_email)
      values (r.tarea_id, r.tipo_notif, v_admin_email)
      on conflict (tarea_id, tipo, destinatario_email) do nothing;
      get diagnostics v_rows = row_count;
      v_insertadas := v_insertadas + v_rows;
    end if;

    if r.funcionario_email is not null then
      insert into notificaciones (tarea_id, tipo, destinatario_email)
      values (r.tarea_id, r.tipo_notif, r.funcionario_email)
      on conflict (tarea_id, tipo, destinatario_email) do nothing;
      get diagnostics v_rows = row_count;
      v_insertadas := v_insertadas + v_rows;
    end if;
  end loop;

  return v_insertadas;
end;
$$;

grant execute on function es_dia_habil(date) to authenticated, service_role, postgres;
grant execute on function dias_habiles_restantes(date, date) to authenticated, service_role, postgres;
grant execute on function generar_notificaciones_vencimiento() to service_role, postgres;
