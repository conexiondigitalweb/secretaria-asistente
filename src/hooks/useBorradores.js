/**
 * useBorradores — gestión de borradores pendientes de aprobación.
 *
 * Flujo:
 *  1. Lista borradores con estado='pendiente' del usuario autenticado.
 *  2. `aprobar(borrador, clasificacionOverride?)` →
 *       - Si convocatoria con fecha → crea evento directamente
 *       - Si convocatoria sin fecha → retorna { needsFormEvento: true, datosPrellenos }
 *       - Si cualquier otro tipo → crea tarea
 *       - Si clasificacionOverride provisto → actualiza la clasificación en DB antes de crear
 *  3. `aprobarConEvento(borrador, datosEvento)` → crea evento con datos del FormEvento
 *  4. `rechazar(borrador)` → actualiza estado a 'rechazado', no crea nada.
 *
 * Nunca se crea nada sin clic explícito del secretario.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { calcularFechaLimite, prioridadPorTipo } from '../lib/utils'

// ── Marcar como leído en Gmail (efecto secundario, no bloquea el flujo) ────────
async function marcarComoLeido(usuarioEmail, messageId) {
  if (!usuarioEmail || !messageId) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const jwt = session?.access_token
    if (!jwt) return

    const res = await fetch('/api/gmail-mark-read', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${jwt}`,
      },
      body: JSON.stringify({ usuario_email: usuarioEmail, message_id: messageId }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      console.warn('[useBorradores] mark-read failed:', d.error)
    }
  } catch (err) {
    // No propagar — es efecto secundario
    console.warn('[useBorradores] mark-read error:', err.message)
  }
}

// Mapa de clasificación de Claude → tipo válido en tabla tareas
const CLASIFICACION_A_TIPO = {
  tutela:       'tutela',
  peticion:     'peticion',
  queja:        'queja',
  convocatoria: null,   // crea evento, no tarea
  informativo:  'otro',
  spam:         'otro',
}

export function useBorradores() {
  const { user }                            = useAuth()
  const [borradores, setBorradores]         = useState([])
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState(null)
  const [procesando, setProcesando]         = useState(null)  // id del borrador en proceso

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchBorradores = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('borradores_correo')
      .select('*')
      .eq('usuario_email', user.email)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      setBorradores(data ?? [])
    }
    setLoading(false)
  }, [user?.email])

  useEffect(() => {
    fetchBorradores()
  }, [fetchBorradores])

  // ── Aprobar ─────────────────────────────────────────────────────────────────

  /**
   * @param {object}      borrador
   * @param {string|null} clasificacionOverride — clasificación elegida por el usuario (si cambió la de la IA)
   * @returns {{ ok: boolean, tipo?: string, id?: string, needsFormEvento?: boolean, datosPrellenos?: object, error?: string }}
   */
  const aprobar = useCallback(async (borrador, clasificacionOverride = null) => {
    if (!user?.id) return { ok: false, error: 'No hay sesión activa' }
    setProcesando(borrador.id)

    try {
      const datos               = borrador.datos_extraidos ?? {}
      // Usa el override si el usuario cambió la clasificación; si no, la original de la IA
      const clasificacionFinal  = clasificacionOverride ?? borrador.clasificacion

      // Si el usuario cambió la clasificación, actualizarla en la DB para que quede registro
      if (clasificacionOverride && clasificacionOverride !== borrador.clasificacion) {
        await supabase
          .from('borradores_correo')
          .update({ clasificacion: clasificacionOverride })
          .eq('id', borrador.id)
      }

      // ── Convocatoria → crear evento ────────────────────────────────────────
      if (clasificacionFinal === 'convocatoria') {
        // Si no hay fecha extraída → señalizar al caller para abrir FormEvento
        if (!datos.fecha_hora_reunion) {
          setProcesando(null)
          return {
            ok:             false,
            needsFormEvento: true,
            // Datos precargados para el FormEvento (fecha vacía — obligatoria)
            datosPrellenos: {
              titulo:      borrador.asunto ?? '(sin asunto)',
              descripcion: borrador.cuerpo_resumen ?? null,
              lugar:       datos.lugar ?? '',
              tipo:        'reunion',
            },
          }
        }

        // Tiene fecha → crear evento directamente
        const { data: evento, error: errEvento } = await supabase
          .from('eventos_agenda')
          .insert({
            titulo:       borrador.asunto ?? '(sin asunto)',
            descripcion:  borrador.cuerpo_resumen,
            fecha_inicio: datos.fecha_hora_reunion,
            fecha_fin:    null,
            tipo:         'reunion',
            lugar:        datos.lugar ?? null,
            participantes: [],
            created_by:   user.id,
          })
          .select()
          .single()

        if (errEvento) throw new Error(errEvento.message)

        await supabase
          .from('borradores_correo')
          .update({ estado: 'aprobado', evento_id: evento.id })
          .eq('id', borrador.id)

        setBorradores(prev => prev.filter(b => b.id !== borrador.id))
        // Marcar como leído en Gmail (fire-and-forget)
        marcarComoLeido(user.email, borrador.gmail_message_id)
        return { ok: true, tipo: 'evento', id: evento.id }
      }

      // ── Todo lo demás → crear tarea ─────────────────────────────────────────
      const tipoTarea       = CLASIFICACION_A_TIPO[clasificacionFinal] ?? 'otro'
      const fechaRecibido   = borrador.created_at
      const fechaLimiteCalc = calcularFechaLimite(tipoTarea, fechaRecibido)

      const { data: tarea, error: errTarea } = await supabase
        .from('tareas')
        .insert({
          tipo:           tipoTarea,
          origen:         'correo',
          asunto:         borrador.asunto ?? '(sin asunto)',
          descripcion:    borrador.cuerpo_resumen,
          remitente:      borrador.remitente,
          fecha_recibido: fechaRecibido,
          fecha_limite:   fechaLimiteCalc ? fechaLimiteCalc.toISOString() : null,
          estado:         'pendiente',
          prioridad:      prioridadPorTipo(tipoTarea),
          correo_id:      borrador.gmail_message_id,
          radicado:       datos.numero_radicado ?? null,
        })
        .select()
        .single()

      if (errTarea) throw new Error(errTarea.message)

      await supabase
        .from('borradores_correo')
        .update({ estado: 'aprobado', tarea_id: tarea.id })
        .eq('id', borrador.id)

      setBorradores(prev => prev.filter(b => b.id !== borrador.id))
      // Marcar como leído en Gmail (fire-and-forget)
      marcarComoLeido(user.email, borrador.gmail_message_id)
      return { ok: true, tipo: 'tarea', id: tarea.id }

    } catch (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    } finally {
      setProcesando(null)
    }
  }, [user?.id])

  // ── Aprobar con FormEvento (cuando convocatoria no tenía fecha) ─────────────

  /**
   * Crea un evento con los datos del FormEvento y marca el borrador como aprobado.
   * @param {object} borrador
   * @param {object} datosEvento  — datos del FormEvento ya validados (con fecha_inicio obligatoria)
   */
  const aprobarConEvento = useCallback(async (borrador, datosEvento) => {
    if (!user?.id) return { ok: false, error: 'No hay sesión activa' }
    setProcesando(borrador.id)

    try {
      const { data: evento, error: errEvento } = await supabase
        .from('eventos_agenda')
        .insert({ ...datosEvento, created_by: user.id })
        .select()
        .single()

      if (errEvento) throw new Error(errEvento.message)

      await supabase
        .from('borradores_correo')
        .update({ estado: 'aprobado', evento_id: evento.id })
        .eq('id', borrador.id)

      setBorradores(prev => prev.filter(b => b.id !== borrador.id))
      // Marcar como leído en Gmail (fire-and-forget)
      marcarComoLeido(user.email, borrador.gmail_message_id)
      return { ok: true, tipo: 'evento', id: evento.id }

    } catch (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    } finally {
      setProcesando(null)
    }
  }, [user?.id])

  // ── Rechazar ────────────────────────────────────────────────────────────────

  const rechazar = useCallback(async (borrador) => {
    setProcesando(borrador.id)
    try {
      const { error: err } = await supabase
        .from('borradores_correo')
        .update({ estado: 'rechazado' })
        .eq('id', borrador.id)

      if (err) throw new Error(err.message)
      setBorradores(prev => prev.filter(b => b.id !== borrador.id))
      // Marcar como leído en Gmail al rechazar también (fire-and-forget)
      marcarComoLeido(user?.email, borrador.gmail_message_id)
      return { ok: true }
    } catch (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    } finally {
      setProcesando(null)
    }
  }, [user?.email])

  return {
    borradores,
    loading,
    error,
    procesando,
    fetchBorradores,
    aprobar,
    aprobarConEvento,
    rechazar,
  }
}
