/**
 * Vercel Serverless Function — /api/google-calendar
 *
 * Proxy para la Google Calendar API usando el mismo token OAuth de gmail_tokens.
 * El access_token es compartido entre Gmail y Calendar (mismo scope de OAuth).
 *
 * Variables requeridas: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                       GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET
 *
 * GET  ?usuario_email=&timeMin=&timeMax=  → lista eventos entre fechas
 * POST { usuario_email, evento }          → crea evento nuevo
 * PUT  { usuario_email, calendarEventId, evento } → actualiza evento existente
 *
 * Auth: Authorization: Bearer <supabase_jwt>
 */

import { makeSupabase, obtenerTokenValido, verificarJwt } from './_tokenUtils.js'

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

  const authHeader    = req.headers.authorization ?? ''
  const userJwt       = authHeader.replace('Bearer ', '').trim()
  const usuario_email = method === 'GET'
    ? req.query?.usuario_email
    : req.body?.usuario_email

  if (!usuario_email) {
    return res.status(400).json({ ok: false, error: 'usuario_email requerido' })
  }

  const user = await verificarJwt(userJwt, usuario_email, supabase)
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Token inválido o no corresponde al usuario' })
  }

  try {
    const accessToken = await obtenerTokenValido(usuario_email, supabase)
    if (!accessToken) {
      return res.status(400).json({ ok: false, error: 'Google Calendar no conectado (falta token)' })
    }

    // ── GET — listar eventos ─────────────────────────────────────────────────
    if (method === 'GET') {
      const { timeMin, timeMax } = req.query ?? {}
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

      return res.status(200).json({ ok: true, items: data?.items ?? [] })
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
