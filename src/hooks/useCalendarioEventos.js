/**
 * useCalendarioEventos — hook para la vista de calendario (FullCalendar) de Agenda.
 *
 * Llama a /api/google-calendar (GET) que SIEMPRE resuelve el token OAuth del
 * admin server-side. La respuesta combina:
 *   - items            → eventos reales de Google Calendar (ya sincronizados)
 *   - localPendientes   → eventos locales (eventos_agenda) sin calendar_event_id
 *
 * Cachea por rango en memoria (Map) para no re-pedir la misma semana/mes
 * mientras el usuario navega. `invalidar()` limpia el cache — se llama
 * después de crear/editar un evento para forzar refetch del rango actual.
 */

import { useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

function claveRango(inicio, fin) {
  const a = inicio instanceof Date ? inicio.toISOString() : inicio
  const b = fin instanceof Date ? fin.toISOString() : fin
  return `${a}|${b}`
}

export function useCalendarioEventos() {
  const [eventos, setEventos] = useState([])   // ya normalizados para FullCalendar
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const cacheRef = useRef(new Map()) // clave rango → eventos normalizados

  const fetchRango = useCallback(async (inicio, fin, { forzar = false } = {}) => {
    const clave = claveRango(inicio, fin)

    if (!forzar && cacheRef.current.has(clave)) {
      setEventos(cacheRef.current.get(clave))
      return cacheRef.current.get(clave)
    }

    setLoading(true)
    setError(null)

    try {
      const jwt = await getJwt()
      if (!jwt) throw new Error('Sin sesión activa')

      const params = new URLSearchParams({
        fecha_inicio: inicio instanceof Date ? inicio.toISOString() : inicio,
        fecha_fin:    fin instanceof Date ? fin.toISOString() : fin,
      })

      const res  = await fetch(`/api/google-calendar?${params}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        if (data.scopeInsuficiente) {
          setEventos([])
          return []
        }
        throw new Error(data.error ?? 'Error al cargar el calendario')
      }

      const deCalendar = (data.items ?? []).map(e => ({
        id:              `cal-${e.id}`,
        title:           e.summary ?? '(sin título)',
        start:           e.start?.dateTime ?? e.start?.date ?? null,
        end:             e.end?.dateTime   ?? e.end?.date   ?? null,
        allDay:          !e.start?.dateTime,
        backgroundColor: '#16a34a', // verde — sincronizado con Calendar
        borderColor:     '#15803d',
        extendedProps: {
          origen:      'calendar',
          descripcion: e.description ?? null,
          lugar:       e.location ?? null,
          soloLectura: true,
        },
      }))

      const pendientesLocales = (data.localPendientes ?? []).map(e => ({
        id:              `local-${e.id}`,
        title:           e.titulo,
        start:           e.fecha_inicio,
        end:             e.fecha_fin ?? null,
        allDay:          false,
        backgroundColor: '#f59e0b', // amarillo/naranja — local sin sincronizar
        borderColor:     '#d97706',
        extendedProps: {
          origen:      'local',
          eventoId:    e.id,
          descripcion: e.descripcion ?? null,
          lugar:       e.lugar ?? null,
          tipo:        e.tipo,
          soloLectura: false,
        },
      }))

      const normalizados = [...deCalendar, ...pendientesLocales]
      cacheRef.current.set(clave, normalizados)
      setEventos(normalizados)
      return normalizados

    } catch (err) {
      console.warn('[useCalendarioEventos] Error:', err.message)
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const invalidar = useCallback(() => {
    cacheRef.current.clear()
  }, [])

  return { eventos, loading, error, fetchRango, invalidar }
}
