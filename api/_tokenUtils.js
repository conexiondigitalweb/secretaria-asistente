/**
 * _tokenUtils.js — utilidades compartidas para serverless functions
 *
 * Prefijo _ evita que Vercel lo exponga como ruta HTTP.
 * Importar desde cualquier función en api/ con:
 *   import { makeSupabase, obtenerTokenValido } from './_tokenUtils.js'
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Crea un cliente Supabase con service_role (solo para serverless).
 * Lee vars dentro de la función para evitar undefined al cargar módulos antes del env.
 */
export function makeSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Renueva un access_token usando refresh_token directamente con Google.
 * @param {string} refreshToken
 * @returns {{ access_token, expires_in, scope, token_type }}
 */
export async function refreshAccessToken(refreshToken) {
  const clientId     = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET no configurados')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'refresh_token',
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? 'Error renovando token OAuth')
  }
  return data
}

/**
 * Devuelve un access_token válido para el usuario (refresca si expirado).
 * Actualiza gmail_tokens en Supabase si se refresca.
 *
 * @param {string}        usuarioEmail
 * @param {SupabaseClient} supabase    — cliente con service_role
 * @returns {string|null}  access_token válido, o null si no hay token guardado
 */
export async function obtenerTokenValido(usuarioEmail, supabase) {
  // maybeSingle (no single): si no hay fila no es un error, es "no conectado".
  const { data: tokenRow } = await supabase
    .from('gmail_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('usuario_email', usuarioEmail)
    .maybeSingle()

  if (!tokenRow) {
    console.warn(`[tokenUtils] No hay gmail_tokens para ${usuarioEmail}`)
    return null
  }

  // Token vigente (con 60 s de margen)
  const expira = new Date(tokenRow.expires_at).getTime()
  if (expira >= Date.now() + 60_000) return tokenRow.access_token

  // Sin refresh_token → no se puede renovar
  if (!tokenRow.refresh_token) return null

  try {
    const refreshed     = await refreshAccessToken(tokenRow.refresh_token)
    const nuevoExpires  = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

    await supabase
      .from('gmail_tokens')
      .update({
        access_token: refreshed.access_token,
        expires_at:   nuevoExpires,
        // Google devuelve el scope actualizado en el refresh (útil tras re-consentimiento)
        ...(refreshed.scope ? { scope: refreshed.scope } : {}),
      })
      .eq('usuario_email', usuarioEmail)

    return refreshed.access_token
  } catch (err) {
    console.warn('[tokenUtils] Refresh falló, usando token actual:', err.message)
    // Intentar con el token actual — puede que aún sirva
    return tokenRow.access_token
  }
}

/**
 * Verifica el JWT de usuario y devuelve el objeto user de Supabase.
 * Retorna null si el JWT es inválido o no coincide con el email declarado.
 *
 * @param {string}        userJwt
 * @param {string}        usuarioEmail   — email declarado en el body/query
 * @param {SupabaseClient} supabase
 * @returns {{ user } | null}
 */
export async function verificarJwt(userJwt, usuarioEmail, supabase) {
  if (!userJwt) return null
  const { data: { user }, error } = await supabase.auth.getUser(userJwt)
  if (error || !user) return null
  if (user.email !== usuarioEmail) return null
  return user
}

/**
 * Verifica el JWT de cualquier usuario autenticado y activo (sin importar
 * su rol ni su email) — usado por endpoints donde el recurso accedido no
 * pertenece al usuario que llama, sino a una cuenta fija (ej. el token
 * OAuth institucional del admin).
 *
 * @param {string}        userJwt
 * @param {SupabaseClient} supabase   — cliente con service_role
 * @returns {{ user } | null}
 */
export async function verificarUsuarioActivo(userJwt, supabase) {
  if (!userJwt) return null
  const { data: { user }, error } = await supabase.auth.getUser(userJwt)
  if (error || !user) return null

  const { data: perfil } = await supabase
    .from('user_profiles')
    .select('active')
    .eq('id', user.id)
    .maybeSingle()

  if (!perfil?.active) return null
  return user
}

/**
 * Resuelve el email del usuario con role='admin' y active=true —
 * la cuenta institucional cuyo token OAuth se usa para TODA la
 * sincronización de Google Calendar, sin importar quién crea el evento.
 *
 * @param {SupabaseClient} supabase   — cliente con service_role
 * @returns {string|null}
 */
export async function obtenerEmailAdmin(supabase) {
  const { data: admin } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!admin) return null

  const { data, error } = await supabase.auth.admin.getUserById(admin.id)
  if (error || !data?.user) return null
  return data.user.email
}
