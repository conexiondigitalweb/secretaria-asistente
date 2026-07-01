/**
 * Vercel Serverless Function — /api/gmail-sync
 *
 * Lee correos nuevos desde la última sincronización, llama a Claude para
 * clasificar cada uno y crea tareas o eventos en Supabase.
 *
 * Autenticación: el cliente envía su JWT de Supabase en Authorization header.
 * El servidor lo usa para operar con RLS del usuario (sin service role key).
 *
 * Variables de entorno requeridas:
 *   VITE_SUPABASE_URL      (reutilizamos la pública — solo la URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ANTHROPIC_API_KEY
 *
 * Body:  { usuario_email: string }
 * Resp:  { procesados: number, creados: { tareas: number, eventos: number }, historyId: string }
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env.SUPABASE_URL        // sin prefijo VITE_ — accesible en api/
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// Días límite por tipo (lógica Colombia — igual que en utils.js)
const DIAS_LIMITE = { tutela: 10, peticion: 15, queja: 15, solicitud: 15 }

function sumarDiasHabiles(fecha, dias) {
  const d = new Date(fecha)
  let sumados = 0
  while (sumados < dias) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) sumados++
  }
  return d
}

function calcularFechaLimite(tipo, fechaRecibido) {
  const dias = DIAS_LIMITE[tipo]
  if (!dias) return null
  return sumarDiasHabiles(new Date(fechaRecibido), dias).toISOString()
}

function prioridadPorTipo(tipo) {
  if (tipo === 'tutela')  return 'critica'
  if (tipo === 'peticion' || tipo === 'queja') return 'alta'
  return 'media'
}

// ── Gmail API helpers ────────────────────────────────────────

async function gmailFetch(path, accessToken) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail API ${path}: ${err.error?.message ?? res.status}`)
  }
  return res.json()
}

async function getMensajeDetalle(messageId, accessToken) {
  const msg = await gmailFetch(
    `/messages/${messageId}?format=full`,
    accessToken
  )

  const headers = msg.payload?.headers ?? []
  const get = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''

  // Extraer body (plain text preferido sobre html)
  function extractBody(payload) {
    if (!payload) return ''
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8')
    }
    if (payload.parts) {
      const plain = payload.parts.find(p => p.mimeType === 'text/plain')
      if (plain?.body?.data) return Buffer.from(plain.body.data, 'base64').toString('utf-8')
      const html = payload.parts.find(p => p.mimeType === 'text/html')
      if (html?.body?.data) {
        // Strip HTML tags for basic text
        return Buffer.from(html.body.data, 'base64').toString('utf-8')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
    return msg.snippet ?? ''
  }

  return {
    id:        msg.id,
    threadId:  msg.threadId,
    asunto:    get('Subject') || '(sin asunto)',
    remitente: get('From'),
    fecha:     get('Date'),
    cuerpo:    extractBody(msg.payload).slice(0, 6000),
    snippet:   msg.snippet ?? '',
    leido:     !(msg.labelIds ?? []).includes('UNREAD'),
  }
}

// ── Claude clasificación ─────────────────────────────────────

const SYSTEM_CLASIFICADOR = `Eres el asistente de clasificación de correos de la Secretaría de Educación, Cultura y Turismo del Municipio de Ocaña, Norte de Santander, Colombia.

Tu tarea es clasificar correos electrónicos entrantes y extraer información estructurada.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones, sin bloques de código.`

async function clasificarConClaude(correo) {
  const prompt = `Clasifica este correo y extrae la información solicitada.

ASUNTO: ${correo.asunto}
REMITENTE: ${correo.remitente}
FECHA: ${correo.fecha}
CUERPO:
${correo.cuerpo}

Responde con este JSON exacto (todos los campos son requeridos):
{
  "tipo": "tutela" | "peticion" | "queja" | "solicitud" | "convocatoria" | "informativo" | "otro",
  "asunto_resumido": "máx 120 caracteres, claro y descriptivo",
  "descripcion": "resumen de 2-3 oraciones del contenido",
  "accion": "crear_tarea" | "crear_evento" | "ignorar",
  "radicado": "número de radicado si aparece en el correo, o null",
  "fecha_evento": "ISO 8601 si es convocatoria con fecha explícita, o null",
  "hora_evento": "HH:MM si se menciona hora, o null",
  "lugar_evento": "lugar si se menciona, o null",
  "prioridad_sugerida": "critica" | "alta" | "media" | "baja"
}

Reglas:
- "tutela": menciona acción de tutela, derechos fundamentales, juzgado, demandante
- "peticion": derecho de petición, solicitud formal de ciudadano o entidad
- "queja": queja, reclamo, inconformidad
- "solicitud": solicitud interna, requerimiento institucional
- "convocatoria": reunión, evento, citación con fecha → accion="crear_evento"
- "informativo": boletines, newsletters, notificaciones automáticas → accion="ignorar"
- "otro": no encaja en las anteriores
- Tutelas y peticiones siempre accion="crear_tarea"
- Si no hay fecha explícita para evento, usa accion="crear_tarea"`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: 512,
      system:     SYSTEM_CLASIFICADOR,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Claude: ${err.error?.message ?? res.status}`)
  }

  const data = await res.json()
  const texto = data.content?.[0]?.text ?? '{}'

  try {
    return JSON.parse(texto)
  } catch {
    // Intentar extraer JSON si Claude agregó algo extra
    const match = texto.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error(`Claude devolvió JSON inválido: ${texto.slice(0, 200)}`)
  }
}

// ── Handler principal ────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Variables de entorno del servidor no configuradas' })
  }

  // JWT del usuario en el header Authorization
  const authHeader = req.headers.authorization ?? ''
  const userJwt    = authHeader.replace('Bearer ', '').trim()
  if (!userJwt) {
    return res.status(401).json({ error: 'Token de autenticación requerido' })
  }

  const { usuario_email } = req.body ?? {}
  if (!usuario_email) {
    return res.status(400).json({ error: 'Campo usuario_email requerido' })
  }

  // Cliente Supabase con service role (para escritura cross-RLS)
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
    // 1 — Obtener access token de Gmail (con lógica de refresh si es necesario)
    const { data: tokenRow } = await supabase
      .from('gmail_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('usuario_email', usuario_email)
      .single()

    if (!tokenRow) {
      return res.status(400).json({ error: 'Gmail no conectado para este usuario' })
    }

    // Refrescar si el token expiró (con 60s de margen)
    let accessToken = tokenRow.access_token
    const expira    = new Date(tokenRow.expires_at).getTime()
    if (expira < Date.now() + 60_000 && tokenRow.refresh_token) {
      const refreshRes = await fetch('/api/gmail-refresh-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refresh_token: tokenRow.refresh_token }),
      })
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json()
        accessToken = refreshed.access_token
        await supabase.from('gmail_tokens').update({
          access_token: refreshed.access_token,
          expires_at:   new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        }).eq('usuario_email', usuario_email)
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
      // Sync incremental: solo mensajes nuevos desde el último historyId
      const histData = await gmailFetch(
        `/history?startHistoryId=${syncRow.history_id}&historyTypes=messageAdded&labelId=INBOX`,
        accessToken
      )
      nuevoHistoryId = histData.historyId ?? syncRow.history_id

      const historyRecords = histData.history ?? []
      const idsVistos = new Set()
      for (const record of historyRecords) {
        for (const added of record.messagesAdded ?? []) {
          const id = added.message?.id
          if (id && !idsVistos.has(id)) {
            idsVistos.add(id)
            mensajesParaProcesar.push(id)
          }
        }
      }
    } else {
      // Primera sync: últimos 20 correos de la bandeja de entrada
      const listData = await gmailFetch(
        '/messages?maxResults=20&labelIds=INBOX',
        accessToken
      )
      nuevoHistoryId = listData.historyId ?? null
      mensajesParaProcesar = (listData.messages ?? []).map(m => m.id)
    }

    // 3 — Filtrar IDs ya procesados (por correo_id en tareas)
    if (mensajesParaProcesar.length > 0) {
      const { data: yaExisten } = await supabase
        .from('tareas')
        .select('correo_id')
        .in('correo_id', mensajesParaProcesar)
      const procesados = new Set((yaExisten ?? []).map(t => t.correo_id))
      mensajesParaProcesar = mensajesParaProcesar.filter(id => !procesados.has(id))
    }

    // 4 — Procesar cada mensaje
    let tareasCreadas = 0
    let eventosCreados = 0

    for (const messageId of mensajesParaProcesar) {
      try {
        const correo      = await getMensajeDetalle(messageId, accessToken)
        const clasificacion = await clasificarConClaude(correo)

        if (clasificacion.accion === 'ignorar') continue

        const fechaRecibido = new Date(correo.fecha).toISOString()

        if (clasificacion.accion === 'crear_evento' && clasificacion.fecha_evento) {
          // Crear evento en agenda
          let fechaInicio = clasificacion.fecha_evento
          if (clasificacion.hora_evento) {
            const [h, m] = clasificacion.hora_evento.split(':')
            const d = new Date(fechaInicio)
            d.setHours(parseInt(h), parseInt(m), 0, 0)
            fechaInicio = d.toISOString()
          }

          await supabase.from('eventos_agenda').insert([{
            titulo:      clasificacion.asunto_resumido,
            descripcion: `${clasificacion.descripcion}\n\nFuente: correo de ${correo.remitente}`,
            fecha_inicio: fechaInicio,
            fecha_fin:   null,
            tipo:        'evento',
            lugar:       clasificacion.lugar_evento ?? null,
            created_by:  user.id,
          }])
          eventosCreados++

        } else {
          // Crear tarea
          const tipo         = ['tutela','peticion','queja','solicitud','otro'].includes(clasificacion.tipo)
            ? clasificacion.tipo : 'otro'
          const fechaLimite  = calcularFechaLimite(tipo, fechaRecibido)
          const prioridad    = clasificacion.prioridad_sugerida
            && ['critica','alta','media','baja'].includes(clasificacion.prioridad_sugerida)
              ? clasificacion.prioridad_sugerida
              : prioridadPorTipo(tipo)

          await supabase.from('tareas').insert([{
            tipo,
            origen:         'correo',
            asunto:         clasificacion.asunto_resumido,
            descripcion:    clasificacion.descripcion,
            remitente:      correo.remitente,
            fecha_recibido: fechaRecibido,
            fecha_limite:   fechaLimite,
            estado:         'pendiente',
            prioridad,
            correo_id:      messageId,
            radicado:       clasificacion.radicado ?? null,
          }])
          tareasCreadas++
        }

      } catch (msgErr) {
        // Log pero continuar con el siguiente mensaje
        console.error(`[gmail-sync] Error procesando mensaje ${messageId}:`, msgErr.message)
      }
    }

    // 5 — Actualizar estado de sync
    await supabase.from('gmail_sync').upsert({
      usuario_email:      usuario_email,
      history_id:         nuevoHistoryId,
      last_sync_at:       new Date().toISOString(),
      emails_procesados:  (syncRow?.emails_procesados ?? 0) + mensajesParaProcesar.length,
    }, { onConflict: 'usuario_email' })

    return res.status(200).json({
      procesados:  mensajesParaProcesar.length,
      creados:     { tareas: tareasCreadas, eventos: eventosCreados },
      historyId:   nuevoHistoryId,
    })

  } catch (err) {
    console.error('[gmail-sync] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
