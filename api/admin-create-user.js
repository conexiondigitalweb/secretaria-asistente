/**
 * Vercel Serverless Function — /api/admin-create-user
 *
 * Crea una cuenta de asistente (usuario+contraseña) usando
 * supabase.auth.admin.createUser() con la service_role key.
 * Solo puede ser invocada por un usuario cuyo rol en user_profiles
 * sea 'admin' — se verifica el JWT recibido antes de hacer nada.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Body: { username: string, password: string, role: 'admin' | 'agenda' }
 * Resp: { user: { id, email } }
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const SUPABASE_URL     = process.env.SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados' })
  }

  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)
  if (callerError || !callerData?.user) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }

  const { data: callerProfile, error: perfilError } = await supabaseAdmin
    .from('user_profiles')
    .select('role, active')
    .eq('id', callerData.user.id)
    .single()

  if (perfilError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.active) {
    return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' })
  }

  const { username, password, role } = req.body ?? {}

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Campos requeridos: username, password, role' })
  }
  if (!['admin', 'agenda'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' })
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
  }

  const usernameLimpio = String(username).trim().toLowerCase()
  if (!/^[a-z0-9._-]+$/.test(usernameLimpio)) {
    return res.status(400).json({ error: 'El usuario solo puede contener letras, números, punto, guion y guion bajo' })
  }
  const email = `${usernameLimpio}@secretariaos.local`

  const { data: creado, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    return res.status(400).json({ error: createError.message })
  }

  const { error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .insert({ id: creado.user.id, role, display_name: usernameLimpio, active: true })

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(creado.user.id)
    return res.status(500).json({ error: profileError.message })
  }

  return res.status(200).json({ user: { id: creado.user.id, email } })
}
