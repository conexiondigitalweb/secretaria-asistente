/**
 * borradorIA.js — helper para generar/regenerar el borrador de respuesta
 * con IA (Claude) de una tarea tipo tutela, petición o queja.
 *
 * Llama a /api/generar-borrador (serverless), que verifica que quien
 * llama sea admin, invoca a Claude y guarda el resultado en
 * tareas.borrador_ia server-side. Nunca se envía nada automáticamente —
 * el borrador queda para revisión/edición del secretario.
 */

import { supabase } from './supabase'

async function getJwt() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * @param {string} tareaId
 * @returns {{ ok: boolean, borrador?: string, error?: string }}
 */
export async function generarBorradorIA(tareaId) {
  try {
    const jwt = await getJwt()
    if (!jwt) return { ok: false, error: 'Sin sesión activa' }

    const res = await fetch('/api/generar-borrador', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${jwt}`,
      },
      body: JSON.stringify({ tarea_id: tareaId }),
    })

    const data = await res.json()
    if (!res.ok) {
      return { ok: false, error: data?.error ?? 'Error al generar el borrador' }
    }

    return { ok: true, borrador: data.borrador }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
