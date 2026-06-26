/**
 * tutelas.js — Lógica de deduplicación de tutelas
 *
 * Diseñado para ser reutilizado en:
 *   - FormTarea (Fase 1): verificación manual al crear tarea
 *   - Lector de correos (Fase 3): verificación automática al procesar Gmail
 */

import { supabase } from './supabase'

/**
 * Normaliza un número de radicado eliminando espacios, guiones y ceros
 * iniciales para comparación robusta.
 * Ej: "11001-22-03-000-2026-00123-00" → "11001220030002026001230"
 * @param {string} radicado
 * @returns {string}
 */
export function normalizarRadicado(radicado) {
  return radicado.replace(/[\s\-_.]/g, '').replace(/^0+/, '').toUpperCase()
}

/**
 * Busca una tutela existente por número de radicado.
 * La búsqueda es insensible a guiones, espacios y ceros iniciales.
 *
 * @param {string} radicado  — Número de radicado a buscar
 * @returns {Promise<{ tarea: object|null, error: object|null }>}
 */
export async function verificarRadicado(radicado) {
  if (!radicado?.trim()) return { tarea: null, error: null }

  // Buscar por coincidencia exacta primero (más rápido, usa el índice)
  const { data: exacta, error: e1 } = await supabase
    .from('tareas')
    .select('id, asunto, remitente, fecha_recibido, fecha_limite, estado, prioridad, radicado, correo_id')
    .eq('tipo', 'tutela')
    .eq('radicado', radicado.trim())
    .maybeSingle()

  if (e1) return { tarea: null, error: e1 }
  if (exacta) return { tarea: exacta, error: null }

  // Búsqueda flexible: traer tutelas con radicado similar (mismo prefijo numérico)
  // Se normaliza en cliente para no depender de extensiones SQL
  const normalizado = normalizarRadicado(radicado)
  if (normalizado.length < 4) return { tarea: null, error: null }

  const { data: candidatas, error: e2 } = await supabase
    .from('tareas')
    .select('id, asunto, remitente, fecha_recibido, fecha_limite, estado, prioridad, radicado, correo_id')
    .eq('tipo', 'tutela')
    .not('radicado', 'is', null)
    .ilike('radicado', `%${normalizado.slice(0, 8)}%`)

  if (e2) return { tarea: null, error: e2 }

  const coincidencia = (candidatas ?? []).find(
    t => normalizarRadicado(t.radicado) === normalizado
  )

  return { tarea: coincidencia ?? null, error: null }
}

/**
 * Vincula un correo Gmail a una tarea existente.
 * Usado en Fase 3 cuando se detecta que el correo corresponde a una tutela ya registrada.
 *
 * @param {string} tareaId
 * @param {string} correoId  — ID del mensaje en Gmail
 * @returns {Promise<{ error: object|null }>}
 */
export async function vincularCorreoATarea(tareaId, correoId) {
  const { error } = await supabase
    .from('tareas')
    .update({ correo_id: correoId, updated_at: new Date().toISOString() })
    .eq('id', tareaId)

  return { error }
}
