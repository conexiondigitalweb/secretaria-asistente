/**
 * Vercel Serverless Function — /api/gmail-mark-read
 *
 * Quita el label UNREAD de un mensaje de Gmail usando gmail.modify scope.
 * Si falla, responde 200 de todas formas — es efecto secundario, no crítico.
 *
 * Body:  { usuario_email: string, message_id: string }
 * Auth:  Authorization: Bearer <supabase_jwt>
 * Resp:  { ok: boolean, error?: string }
 */

import { makeSupabase, obtenerTokenValido, verificarJwt } from './_tokenUtils.js'

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

  const authHeader  = req.headers.authorization ?? ''
  const userJwt     = authHeader.replace('Bearer ', '').trim()
  const { usuario_email, message_id } = req.body ?? {}

  if (!usuario_email || !message_id) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: usuario_email, message_id' })
  }

  const user = await verificarJwt(userJwt, usuario_email, supabase)
  if (!user) {
    // No interrumpir el flujo del cliente — responder OK pero sin marcar
    console.warn('[gmail-mark-read] JWT inválido para', usuario_email)
    return res.status(200).json({ ok: false, error: 'JWT inválido' })
  }

  try {
    const accessToken = await obtenerTokenValido(usuario_email, supabase)
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

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('[gmail-mark-read] Error:', err.message)
    return res.status(200).json({ ok: false, error: err.message })
  }
}
