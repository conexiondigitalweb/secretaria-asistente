/**
 * Vercel Serverless Function — /api/send-email
 *
 * Proxy hacia Resend que evita el problema de CORS al llamar desde el navegador.
 * La RESEND_API_KEY vive solo en el servidor (sin prefijo VITE_).
 *
 * Body esperado (JSON):
 *   { to: string, subject: string, html: string }
 *
 * Respuesta:
 *   200 { ok: true, id: string }
 *   400 { ok: false, error: string }   — datos faltantes
 *   500 { ok: false, error: string }   — error de Resend o config
 */
export default async function handler(req, res) {
  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ ok: false, error: 'RESEND_API_KEY no configurada en el servidor' })
  }

  const { to, subject, html } = req.body ?? {}

  if (!to || !subject || !html) {
    return res.status(400).json({ ok: false, error: 'Faltan campos: to, subject, html' })
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'SecretaríaOS <notificaciones@ocanaturismo.com>',
        to: [to],
        subject,
        html,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: data?.message ?? 'Error de Resend' })
    }

    return res.status(200).json({ ok: true, id: data.id })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
