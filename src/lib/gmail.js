/**
 * gmail.js — integración Gmail OAuth para SecretaríaOS
 *
 * Flujo:
 *  1. iniciarAuthGmail()       → redirige a Google OAuth
 *  2. /oauth/callback          → recibe ?code= y llama a /api/gmail-token-exchange
 *  3. guardarTokens()          → persiste en tabla gmail_tokens (Supabase)
 *  4. obtenerAccessToken()     → devuelve token válido (refresca si expirado)
 *  5. listarCorreosRecientes() → últimos N correos via Gmail API REST
 */

import { supabase } from './supabase'

const CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID
const SCOPES    = 'https://www.googleapis.com/auth/gmail.readonly'

// ── Redirect URI ─────────────────────────────────────────────
// Desarrollo:  http://localhost:5173/oauth/callback
// Producción:  https://<dominio>/oauth/callback
export function getRedirectUri() {
  return `${window.location.origin}/oauth/callback`
}

// ── 1. Iniciar flujo OAuth ────────────────────────────────────
export function iniciarAuthGmail() {
  if (!CLIENT_ID) throw new Error('VITE_GMAIL_CLIENT_ID no configurado en .env.local')

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  getRedirectUri(),
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',  // solicita refresh_token
    prompt:        'consent',  // fuerza consentimiento para garantizar refresh_token
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── 2. Intercambiar código por tokens (via serverless) ────────
export async function intercambiarCodigo(code) {
  const res = await fetch('/api/gmail-token-exchange', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code, redirect_uri: getRedirectUri() }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Error intercambiando código OAuth')
  }
  return res.json()
  // → { access_token, refresh_token, expires_in, scope, token_type }
}

// ── 3. Guardar tokens en Supabase ─────────────────────────────
export async function guardarTokens(tokens, usuarioEmail) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const payload = {
    usuario_email: usuarioEmail,
    access_token:  tokens.access_token,
    expires_at:    expiresAt,
    scope:         tokens.scope ?? SCOPES,
    token_type:    tokens.token_type ?? 'Bearer',
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
  }

  const { data, error } = await supabase
    .from('gmail_tokens')
    .upsert(payload, { onConflict: 'usuario_email' })
    .select()
    .single()

  if (error) throw new Error(`Error guardando tokens: ${error.message}`)
  return data
}

// ── 4. Obtener access_token válido (refresca si expirado) ─────
export async function obtenerAccessToken(usuarioEmail) {
  const { data: tokenRow, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('usuario_email', usuarioEmail)
    .single()

  if (error || !tokenRow) return null

  // ¿Sigue vigente? (con 60 s de margen)
  const vigente = new Date(tokenRow.expires_at).getTime() > Date.now() + 60_000
  if (vigente) return tokenRow.access_token

  // Refrescar
  if (!tokenRow.refresh_token) {
    // Sin refresh_token → el usuario debe reconectar
    await supabase.from('gmail_tokens').delete().eq('usuario_email', usuarioEmail)
    return null
  }

  const res = await fetch('/api/gmail-refresh-token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refresh_token: tokenRow.refresh_token }),
  })

  if (!res.ok) {
    // Token revocado → limpiar y forzar reconexión
    await supabase.from('gmail_tokens').delete().eq('usuario_email', usuarioEmail)
    return null
  }

  const refreshed = await res.json()
  const nuevoExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await supabase
    .from('gmail_tokens')
    .update({ access_token: refreshed.access_token, expires_at: nuevoExpires })
    .eq('usuario_email', usuarioEmail)

  return refreshed.access_token
}

// ── Estado de conexión ────────────────────────────────────────
export async function estadoConexionGmail(usuarioEmail) {
  const { data } = await supabase
    .from('gmail_tokens')
    .select('usuario_email, expires_at, scope, updated_at')
    .eq('usuario_email', usuarioEmail)
    .maybeSingle()

  if (!data) return { conectado: false }
  return { conectado: true, expires_at: data.expires_at, scope: data.scope, updated_at: data.updated_at }
}

// ── Desconectar Gmail (revocar + borrar) ─────────────────────
export async function desconectarGmail(usuarioEmail) {
  const { data: tokenRow } = await supabase
    .from('gmail_tokens')
    .select('access_token')
    .eq('usuario_email', usuarioEmail)
    .maybeSingle()

  if (tokenRow?.access_token) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.access_token}`, {
      method: 'POST',
    }).catch(() => {})
  }

  const { error } = await supabase
    .from('gmail_tokens')
    .delete()
    .eq('usuario_email', usuarioEmail)

  if (error) throw new Error(`Error desconectando Gmail: ${error.message}`)
}

// ── 5. Listar correos recientes ───────────────────────────────
export async function listarCorreosRecientes(usuarioEmail, maxResults = 10) {
  const accessToken = await obtenerAccessToken(usuarioEmail)
  if (!accessToken) throw new Error('Gmail no conectado o token expirado')

  // Paso 1 — IDs de mensajes
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) {
    const err = await listRes.json()
    throw new Error(err.error?.message ?? 'Error listando correos de Gmail')
  }

  const listData = await listRes.json()
  const mensajes = listData.messages ?? []
  if (mensajes.length === 0) return []

  // Paso 2 — Metadatos de cada mensaje
  const detalles = await Promise.all(
    mensajes.map(async ({ id }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
        `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) return null

      const msg     = await msgRes.json()
      const headers = msg.payload?.headers ?? []
      const get     = (name) => headers.find(h => h.name === name)?.value ?? ''

      return {
        id:        msg.id,
        threadId:  msg.threadId,
        asunto:    get('Subject') || '(sin asunto)',
        remitente: get('From'),
        fecha:     get('Date'),
        snippet:   msg.snippet ?? '',
        leido:     !(msg.labelIds ?? []).includes('UNREAD'),
      }
    })
  )

  return detalles.filter(Boolean)
}
