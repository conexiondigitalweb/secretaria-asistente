/**
 * useGoogleCalendar — hook para leer eventos de Google Calendar.
 *
 * Llama a /api/google-calendar (serverless) para no exponer el access_token al cliente.
 * Los eventos devueltos son normalizados al formato de eventos_agenda para
 * mostrarlos mezclados en Agenda.jsx.
 *
 * SIEMPRE lee el calendario de la cuenta admin (resuelto server-side) —
 * cualquier usuario autenticado y activo (admin o agenda) puede llamarlo.
 *
 * Nota: los eventos de Calendar son solo LECTURA desde la app —
 * para crearlos se usa calendarSync.js.
 */

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Normaliza un evento de Google Calendar al shape de eventos_agenda
 * para poder renderizarlos con los mismos componentes.
 */
function normalizarEvento(e) {
  return {
    // Identificadores — null para campos de Supabase que no aplican
    id:               null,
    calendarEventId:  e.id,
    origen:           'calendar',   // diferenciador para la UI

    // Datos del evento
    titulo:       e.summary ?? '(sin título)',
    descripcion:  e.description ?? null,
    lugar:        e.location ?? null,
    tipo:         'evento',

    // Fechas: Google devuelve dateTime (con hora) o date (solo fecha, todo-el-día)
    fecha_inicio: e.start?.dateTime ?? e.start?.date ?? null,
    fecha_fin:    e.end?.dateTime   ?? e.end?.date   ?? null,
    todo_el_dia:  !e.start?.dateTime,   // true si es evento de todo el día

    // Sin delegado ni participantes en la representación local
    delegado:     null,
    participantes: e.attendees?.map(a => a.email) ?? [],
  }
}

export function useGoogleCalendar() {
  const [eventos, setEventos]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const fetchEventos = useCallback(async (fechaInicio, fechaFin) => {
    setLoading(true)
    setError(null)

    try {
      const jwt = await getJwt()
      if (!jwt) throw new Error('Sin sesión activa')

      const params = new URLSearchParams({
        ...(fechaInicio
          ? { timeMin: fechaInicio instanceof Date ? fechaInicio.toISOString() : fechaInicio }
          : {}),
        ...(fechaFin
          ? { timeMax: fechaFin instanceof Date ? fechaFin.toISOString() : fechaFin }
          : {}),
      })

      const res = await fetch(`/api/google-calendar?${params}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        // Si el error es de scopes insuficientes no lo mostramos como error crítico
        if (data.scopeInsuficiente) {
          console.info('[useGoogleCalendar] Sin scope de Calendar — reconectar en Configuración')
          setEventos([])
          return []
        }
        throw new Error(data.error ?? 'Error al cargar eventos de Calendar')
      }

      const normalizados = (data.items ?? []).map(normalizarEvento)
      setEventos(normalizados)
      return normalizados

    } catch (err) {
      console.warn('[useGoogleCalendar] Error:', err.message)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  return { eventos, loading, error, fetchEventos }
}
