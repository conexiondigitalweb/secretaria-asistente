/**
 * Vercel Serverless Function — /api/google-calendar
 *
 * Proxy para la Google Calendar API. SIEMPRE usa el token OAuth de la
 * cuenta institucional (usuario con role='admin' en user_profiles),
 * sin importar qué usuario de la app esté haciendo la llamada — los
 * asistentes (role='agenda') no tienen ni deben tener su propia
 * conexión OAuth con Google.
 *
 * Variables requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                       GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET
 *
 * GET  ?timeMin=&timeMax=            → lista eventos entre fechas
 *      (acepta también fecha_inicio/fecha_fin como alias). Además de los
 *      eventos de Google Calendar (`items`), la respuesta incluye
 *      `localPendientes`: eventos locales (eventos_agenda) del mismo rango
 *      que AÚN NO tienen calendar_event_id (creados pero no sincronizados),
 *      para que la vista de calendario muestre la disponibilidad completa.
 * POST { evento }                    → crea evento nuevo
 * PUT  { calendarEventId, evento }   → actualiza evento existente
 *
 * Auth: Authorization: Bearer <supabase_jwt> de cualquier usuario activo
 *       (admin o agenda) — no se exige que coincida con la cuenta OAuth.
 */

import { makeSupabase, obtenerTokenValido, verificarUsuarioActivo, obtenerEmailAdmin } from './_tokenUtils.js'

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

async function calendarFetch(path, accessToken, method = 'GET', body = null) {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (res.status === 204) return null  // No Content (DELETE)

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Calendar API error ${res.status}`)
  }

  return data
}

export default async function handler(req, res) {
  const { method } = req

  if (!['GET', 'POST', 'PUT'].includes(method)) {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let supabase
  try {
    supabase = makeSupabase()
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }

  const authHeader = req.headers.authorization ?? ''
  const userJwt     = authHeader.replace('Bearer ', '').trim()

  const user = await verificarUsuarioActivo(userJwt, supabase)
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Token inválido o usuario inactivo' })
  }

  try {
    const emailAdmin = await obtenerEmailAdmin(supabase)
    if (!emailAdmin) {
      return res.status(400).json({ ok: false, error: 'No hay una cuenta admin configurada' })
    }

    const accessToken = await obtenerTokenValido(emailAdmin, supabase)
    if (!accessToken) {
      return res.status(400).json({ ok: false, error: 'Google Calendar no conectado (falta token del admin)' })
    }

    // ── GET — listar eventos ─────────────────────────────────────────────────
    if (method === 'GET') {
      const query = req.query ?? {}
      const timeMin = query.timeMin ?? query.fecha_inicio
      const timeMax = query.timeMax ?? query.fecha_fin

      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy:      'startTime',
        maxResults:   '250',
        ...(timeMin ? { timeMin } : {}),
        ...(timeMax ? { timeMax } : {}),
      })

      const data = await calendarFetch(
        `/calendars/primary/events?${params}`,
        accessToken
      )

      // Eventos locales del mismo rango que aún no fueron sincronizados
      // con Google Calendar (calendar_event_id IS NULL) — se combinan con
      // los de Calendar para que la vista de disponibilidad esté completa.
      let localPendientes = []
      try {
        let localQuery = supabase
          .from('eventos_agenda')
          .select('id, titulo, descripcion, tipo, lugar, fecha_inicio, fecha_fin, delegado_id')
          .is('calendar_event_id', null)

        if (timeMin) localQuery = localQuery.gte('fecha_inicio', timeMin)
        if (timeMax) localQuery = localQuery.lte('fecha_inicio', timeMax)

        const { data: locales, error: localErr } = await localQuery
        if (!localErr) localPendientes = locales ?? []
      } catch (e) {
        console.warn('[google-calendar] Error obteniendo eventos locales pendientes:', e.message)
      }

      return res.status(200).json({
        ok:    true,
        items: data?.items ?? [],
        localPendientes,
      })
    }

    // ── POST — crear evento ──────────────────────────────────────────────────
    if (method === 'POST') {
      const { evento } = req.body ?? {}
      if (!evento) {
        return res.status(400).json({ ok: false, error: 'Campo "evento" requerido' })
      }

      const data = await calendarFetch(
        '/calendars/primary/events',
        accessToken,
        'POST',
        evento
      )

      return res.status(200).json({ ok: true, event: data })
    }

    // ── PUT — actualizar evento ──────────────────────────────────────────────
    if (method === 'PUT') {
      const { calendarEventId, evento } = req.body ?? {}
      if (!calendarEventId || !evento) {
        return res.status(400).json({ ok: false, error: 'Faltan calendarEventId y/o evento' })
      }

      const data = await calendarFetch(
        `/calendars/primary/events/${calendarEventId}`,
        accessToken,
        'PUT',
        evento
      )

      return res.status(200).json({ ok: true, event: data })
    }

  } catch (err) {
    console.error('[google-calendar] Error:', err.message)
    // Si el error es de scopes insuficientes, darlo a conocer claramente
    const esScopes = err.message.includes('insufficient') || err.message.includes('403')
    return res.status(esScopes ? 403 : 500).json({
      ok:             false,
      error:          err.message,
      scopeInsuficiente: esScopes,
    })
  }
}
