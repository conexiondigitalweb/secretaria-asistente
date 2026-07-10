/**
 * Vercel Serverless Function — /api/gmail-mark-read
 *
 * Quita el label UNREAD de un mensaje de Gmail usando gmail.modify scope.
 * Si falla, responde 200 de todas formas — es efecto secundario, no crítico.
 *
 * SIEMPRE usa el token OAuth de la cuenta institucional (usuario con
 * role='admin' en user_profiles), sin importar qué usuario de la app esté
 * aprobando/rechazando el borrador — los asistentes (role='agenda') no
 * tienen ni deben tener su propia conexión OAuth con Google. Mismo patrón
 * centralizado que /api/google-calendar.js.
 *
 * Body:  { message_id: string }
 * Auth:  Authorization: Bearer <supabase_jwt> de cualquier usuario activo
 *        (admin o agenda) — no se exige que coincida con la cuenta OAuth.
 * Resp:  { ok: boolean, error?: string }
 */

import { makeSupabase, obtenerTokenValido, verificarUsuarioActivo, obtenerEmailAdmin } from './_tokenUtils.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let supabase
  try {
    supabase = makeSupabase()
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }

  const authHeader = req.headers.authorization ?? ''
  const userJwt     = authHeader.replace('Bearer ', '').trim()
  const { message_id } = req.body ?? {}

  if (!message_id) {
    return res.status(400).json({ ok: false, error: 'Falta campo: message_id' })
  }

  const user = await verificarUsuarioActivo(userJwt, supabase)
  if (!user) {
    // No interrumpir el flujo del cliente — responder OK pero sin marcar
    console.warn('[gmail-mark-read] Token inválido o usuario inactivo')
    return res.status(200).json({ ok: false, error: 'Token inválido o usuario inactivo' })
  }

  try {
    const emailAdmin = await obtenerEmailAdmin(supabase)
    if (!emailAdmin) {
      return res.status(200).json({ ok: false, error: 'No hay una cuenta admin configurada' })
    }

    const accessToken = await obtenerTokenValido(emailAdmin, supabase)
    if (!accessToken) {
      return res.status(200).json({ ok: false, error: 'Sin token de Gmail' })
    }

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/modify`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      }
    )

    if (!gmailRes.ok) {
      const err = await gmailRes.json().catch(() => ({}))
      const msg = err.error?.message ?? `HTTP ${gmailRes.status}`
      console.warn('[gmail-mark-read] Gmail API error:', msg)
      // Siempre 200 — es efecto secundario
      return res.status(200).json({ ok: false, error: msg })
    }

    console.log(`[gmail-mark-read] Marcado como leído: ${message_id}`)
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('[gmail-mark-read] Error:', err.message)
    return res.status(200).json({ ok: false, error: err.message })
  }
}
