/**
 * Vercel Serverless Function — /api/gmail-sync
 *
 * Lee correos nuevos desde la última sincronización, los clasifica con Claude
 * y los guarda como BORRADORES PENDIENTES en borradores_correo.
 *
 * Nunca crea tareas ni eventos directamente — todo requiere aprobación explícita
 * del secretario desde el Dashboard.
 *
 * Variables de entorno requeridas (todas en entorno Development de Vercel):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *
 * Body:  { usuario_email: string }
 * Resp:  { procesados: number, borradoresPendientes: number, historyId: string }
 */

import { createClient } from '@supabase/supabase-js'
import { clasificarCorreo } from './clasificar-correo.js'

// ── Token refresh (llama directamente a Google — no fetch a /api/*) ──────────

async function refreshAccessToken(refreshToken) {
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
    throw new Error(data.error_description ?? data.error ?? 'Error renovando token Gmail')
  }
  return data  // { access_token, expires_in, scope, token_type }
}

// ── Gmail API helpers ─────────────────────────────────────────────────────────

async function gmailFetch(path, accessToken) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gmail API ${path}: ${err.error?.message ?? res.status}`)
  }
  return res.json()
}

// Labels de Gmail que indican basura — no gastar tokens de Claude en ellos
const LABELS_IGNORAR = new Set(['SPAM', 'TRASH'])

async function getMensajeDetalle(messageId, accessToken) {
  const msg = await gmailFetch(`/messages/${messageId}?format=full`, accessToken)

  const headers = msg.payload?.headers ?? []
  const get = (name) =>
    headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

  function extractBody(payload) {
    if (!payload) return ''
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    }
    if (payload.parts) {
      const plain = payload.parts.find(p => p.mimeType === 'text/plain')
      if (plain?.body?.data) {
        return Buffer.from(plain.body.data, 'base64').toString('utf-8')
      }
      const html = payload.parts.find(p => p.mimeType === 'text/html')
      if (html?.body?.data) {
        return Buffer.from(html.body.data, 'base64')
          .toString('utf-8')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
    }
    return msg.snippet ?? ''
  }

  return {
    id:        msg.id,
    threadId:  msg.threadId,
    labelIds:  msg.labelIds ?? [],   // ← necesario para filtrar SPAM/TRASH
    asunto:    get('Subject') || '(sin asunto)',
    remitente: get('From'),
    fecha:     get('Date'),
    cuerpo:    extractBody(msg.payload).slice(0, 6000),
    snippet:   msg.snippet ?? '',
  }
}

// ── Deduplicación por radicado ────────────────────────────────────────────────

/**
 * Verifica si ya existe una tutela con ese número de radicado en tareas.
 * Usa el cliente service_role — necesita GRANT SELECT en tareas (migración 012).
 */
async function verificarRadicado(radicado, supabase) {
  if (!radicado) return false
  const { data } = await supabase
    .from('tareas')
    .select('id')
    .eq('tipo', 'tutela')
    .eq('radicado', radicado)
    .maybeSingle()
  return !!data
}

// ── Handler principal ─────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Leer vars dentro del handler — evita undefined si el módulo se cargó antes del env
  const SUPABASE_URL      = process.env.SUPABASE_URL
  const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Variables de entorno del servidor no configuradas',
      debug: {
        hasSupabaseUrl:  !!SUPABASE_URL,
        hasServiceRole:  !!SERVICE_ROLE_KEY,
        hasAnthropicKey: !!ANTHROPIC_API_KEY,
      },
    })
  }

  // JWT del usuario para verificar identidad
  const authHeader = req.headers.authorization ?? ''
  const userJwt    = authHeader.replace('Bearer ', '').trim()
  if (!userJwt) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  const { usuario_email } = req.body ?? {}
  if (!usuario_email) {
    return res.status(400).json({ error: 'Campo usuario_email requerido' })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Verificar que el JWT pertenece al email declarado
  const { data: { user }, error: authErr } = await supabase.auth.getUser(userJwt)
  if (authErr || !user) {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
  if (user.email !== usuario_email) {
    return res.status(403).json({ error: 'El token no corresponde al usuario declarado' })
  }

  try {
    // 1 — Obtener access token de Gmail (refrescar si expiró)
    const { data: tokenRow } = await supabase
      .from('gmail_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('usuario_email', usuario_email)
      .single()

    if (!tokenRow) {
      return res.status(400).json({ error: 'Gmail no conectado para este usuario' })
    }

    let accessToken = tokenRow.access_token
    const expira    = new Date(tokenRow.expires_at).getTime()
    if (expira < Date.now() + 60_000 && tokenRow.refresh_token) {
      try {
        const refreshed = await refreshAccessToken(tokenRow.refresh_token)
        accessToken = refreshed.access_token
        await supabase.from('gmail_tokens').update({
          access_token: refreshed.access_token,
          expires_at:   new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('usuario_email', usuario_email)
      } catch (refreshErr) {
        console.warn('[gmail-sync] No se pudo refrescar el token:', refreshErr.message)
        // Continúa con el token actual — puede que aún sirva
      }
    }

    // 2 — Obtener estado de sync anterior
    const { data: syncRow } = await supabase
      .from('gmail_sync')
      .select('history_id, emails_procesados')
      .eq('usuario_email', usuario_email)
      .maybeSingle()

    let mensajesParaProcesar = []
    let nuevoHistoryId       = null

    if (syncRow?.history_id) {
      // Sync incremental — todos los mensajes nuevos (sin filtro labelId para incluir todas las pestañas)
      // SPAM y TRASH se filtran DESPUÉS de obtener detalles, antes de clasificar con Claude
      const histData = await gmailFetch(
        `/history?startHistoryId=${syncRow.history_id}&historyTypes=messageAdded`,
        accessToken
      )
      nuevoHistoryId = histData.historyId ?? syncRow.history_id

      const idsVistos = new Set()
      for (const record of histData.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          const id = added.message?.id
          if (id && !idsVistos.has(id)) {
            idsVistos.add(id)
            mensajesParaProcesar.push(id)
          }
        }
      }
    } else {
      // Primera sync — últimos 50 correos (sin filtro de pestaña para incluir todas)
      // SPAM y TRASH se filtran después al obtener detalles del mensaje
      const listData = await gmailFetch(
        '/messages?maxResults=50',
        accessToken
      )
      nuevoHistoryId = listData.historyId ?? null
      mensajesParaProcesar = (listData.messages ?? []).map(m => m.id)
    }

    // 3 — Filtrar IDs que ya tienen borrador creado
    if (mensajesParaProcesar.length > 0) {
      const { data: yaExisten } = await supabase
        .from('borradores_correo')
        .select('gmail_message_id')
        .in('gmail_message_id', mensajesParaProcesar)
      const procesados = new Set((yaExisten ?? []).map(b => b.gmail_message_id))
      mensajesParaProcesar = mensajesParaProcesar.filter(id => !procesados.has(id))
    }

    // 4 — Clasificar y guardar cada mensaje como borrador
    let borradoresCreados = 0

    for (const messageId of mensajesParaProcesar) {
      try {
        const correo = await getMensajeDetalle(messageId, accessToken)

        // Ignorar SPAM y TRASH — Gmail ya los identificó, no gastar tokens de Claude
        if (correo.labelIds.some(l => LABELS_IGNORAR.has(l))) {
          console.log(`[gmail-sync] Ignorando mensaje ${messageId} (SPAM/TRASH)`)
          continue
        }

        // Clasificar con Claude
        const clasificacion = await clasificarCorreo({
          asunto:    correo.asunto,
          cuerpo:    correo.cuerpo,
          remitente: correo.remitente,
        }, ANTHROPIC_API_KEY)

        // Armar datos_extraidos
        const datosExtraidos = {
          numero_radicado:    clasificacion.numero_radicado  ?? null,
          fecha_limite:       clasificacion.fecha_limite      ?? null,
          lugar:              clasificacion.lugar              ?? null,
          fecha_hora_reunion: clasificacion.fecha_hora_reunion ?? null,
          es_duplicado:       false,
        }

        // Verificar duplicado por radicado (solo tutelas y peticiones)
        if (
          clasificacion.numero_radicado &&
          (clasificacion.clasificacion === 'tutela' || clasificacion.clasificacion === 'peticion')
        ) {
          const esDuplicado = await verificarRadicado(clasificacion.numero_radicado, supabase)
          if (esDuplicado) {
            datosExtraidos.es_duplicado = true
            console.log(
              `[gmail-sync] Radicado duplicado ${clasificacion.numero_radicado} — se guarda borrador marcado`
            )
          }
        }

        // Insertar borrador — estado siempre 'pendiente', nunca crea tarea/evento directamente
        await supabase.from('borradores_correo').insert({
          gmail_message_id: messageId,
          usuario_email,
          remitente:        correo.remitente,
          asunto:           correo.asunto,
          cuerpo_resumen:   clasificacion.resumen,
          clasificacion:    clasificacion.clasificacion,
          confianza:        clasificacion.confianza,
          datos_extraidos:  datosExtraidos,
          estado:           'pendiente',
        })

        borradoresCreados++
      } catch (msgErr) {
        console.error(`[gmail-sync] Error procesando mensaje ${messageId}:`, msgErr.message)
        // Continúa con el siguiente — no romper el flujo por un correo
      }
    }

    // 5 — Contar borradores pendientes totales del usuario
    const { count: borradoresPendientes } = await supabase
      .from('borradores_correo')
      .select('*', { count: 'exact', head: true })
      .eq('usuario_email', usuario_email)
      .eq('estado', 'pendiente')

    // 6 — Actualizar estado de sync
    await supabase.from('gmail_sync').upsert({
      usuario_email,
      history_id:        nuevoHistoryId,
      last_sync_at:      new Date().toISOString(),
      emails_procesados: (syncRow?.emails_procesados ?? 0) + mensajesParaProcesar.length,
    }, { onConflict: 'usuario_email' })

    return res.status(200).json({
      procesados:          mensajesParaProcesar.length,
      borradoresCreados,
      borradoresPendientes: borradoresPendientes ?? 0,
      historyId:           nuevoHistoryId,
    })

  } catch (err) {
    console.error('[gmail-sync] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
