/**
 * calendarSync.js — helper para sincronizar un evento de Supabase con Google Calendar.
 *
 * Usado por Agenda.jsx y Dashboard.jsx (al aprobar borradores).
 * Siempre "best effort" — si falla, el evento local en Supabase ya fue guardado.
 *
 * @returns {{ calendarEventId: string|null, error: string|null }}
 */

import { supabase } from './supabase'

/**
 * Obtiene el JWT de la sesión activa de Supabase.
 */
async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Convierte datos de eventos_agenda al formato de Google Calendar Events.
 */
function toCalendarEvent({ titulo, descripcion, fecha_inicio, fecha_fin, lugar }) {
  const start = fecha_inicio ? new Date(fecha_inicio) : null
  const end   = fecha_fin
    ? new Date(fecha_fin)
    : start
      ? new Date(start.getTime() + 60 * 60 * 1000)  // +1 hora por defecto
      : null

  return {
    summary:     titulo,
    description: descripcion ?? undefined,
    location:    lugar ?? undefined,
    start:  { dateTime: start?.toISOString() },
    end:    { dateTime: end?.toISOString() },
  }
}

/**
 * Crea el evento en Google Calendar y, si tiene éxito, actualiza
 * el campo calendar_event_id en eventos_agenda de Supabase.
 *
 * @param {string} eventoId       — UUID del evento en eventos_agenda
 * @param {object} datosEvento    — { titulo, fecha_inicio, fecha_fin, lugar, descripcion }
 * @param {string} usuarioEmail   — email del usuario autenticado
 * @returns {{ calendarEventId: string|null, error: string|null }}
 */
export async function sincronizarConCalendar(eventoId, datosEvento, usuarioEmail) {
  try {
    const jwt = await getJwt()
    if (!jwt) return { calendarEventId: null, error: 'Sin sesión activa' }

    const calendarEvento = toCalendarEvent(datosEvento)

    const res = await fetch('/api/google-calendar', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${jwt}`,
      },
      body: JSON.stringify({ usuario_email: usuarioEmail, evento: calendarEvento }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      const msg = data.scopeInsuficiente
        ? 'Permisos de Calendar insuficientes — reconecta la cuenta en Configuración'
        : (data.error ?? 'Error al crear evento en Google Calendar')
      return { calendarEventId: null, error: msg }
    }

    const calendarEventId = data.event?.id ?? null

    // Actualizar el registro local con el ID de Calendar
    if (calendarEventId && eventoId) {
      await supabase
        .from('eventos_agenda')
        .update({ calendar_event_id: calendarEventId })
        .eq('id', eventoId)
    }

    return { calendarEventId, error: null }

  } catch (err) {
    console.warn('[calendarSync] Error:', err.message)
    return { calendarEventId: null, error: err.message }
  }
}
