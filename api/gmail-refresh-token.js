/**
 * Vercel Serverless Function — /api/gmail-refresh-token
 *
 * Renueva un access_token expirado usando el refresh_token.
 *
 * Variables de entorno requeridas:
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *
 * Body:  { refresh_token: string }
 * Resp:  { access_token, expires_in, scope, token_type }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId     = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Credenciales OAuth no configuradas en el servidor' })
  }

  const { refresh_token } = req.body ?? {}
  if (!refresh_token) {
    return res.status(400).json({ error: 'Campo "refresh_token" requerido' })
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token,
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    'refresh_token',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error_description ?? data.error ?? 'Error renovando token',
      })
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
