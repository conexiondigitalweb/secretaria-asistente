/**
 * Vercel Serverless Function — /api/gmail-token-exchange
 *
 * Intercambia un código de autorización OAuth por access_token + refresh_token.
 * El client_secret NUNCA sale al navegador — vive solo aquí como variable de entorno.
 *
 * Variables de entorno requeridas (sin prefijo VITE_):
 *   GMAIL_CLIENT_ID      — Client ID de Google Cloud
 *   GMAIL_CLIENT_SECRET  — Client Secret de Google Cloud
 *
 * Body:  { code: string, redirect_uri: string }
 * Resp:  { access_token, refresh_token, expires_in, scope, token_type }
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

  const { code, redirect_uri } = req.body ?? {}
  if (!code || !redirect_uri) {
    return res.status(400).json({ error: 'Campos "code" y "redirect_uri" requeridos' })
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type:    'authorization_code',
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error_description ?? data.error ?? 'Error de Google OAuth',
      })
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
