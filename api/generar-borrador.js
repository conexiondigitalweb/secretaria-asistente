/**
 * Vercel Serverless Function — /api/generar-borrador
 *
 * Genera (o regenera) con Claude un borrador de respuesta institucional
 * para tareas de tipo tutela, petición o queja, y lo guarda en
 * tareas.borrador_ia.
 *
 * Solo puede ser invocada por un usuario cuyo rol en user_profiles sea
 * 'admin' y esté activo — se verifica el JWT recibido antes de hacer
 * nada (mismo patrón que admin-create-user.js). El borrador NUNCA se
 * envía; solo se guarda para que el secretario lo revise, edite y lo
 * use en su propio flujo de respuesta institucional.
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 *
 * Body: { tarea_id: string }
 * Resp: { borrador: string }
 */

import { createClient } from '@supabase/supabase-js'

// ── Contexto institucional — inyectado siempre en el system prompt ─────────
const CONTEXTO_INSTITUCIONAL = `Eres el redactor de borradores de respuesta de la Secretaría de Educación, Cultura y Turismo del Municipio de Ocaña, Norte de Santander, Colombia.

Contexto institucional que debes tener siempre presente:
- Esta Secretaría municipal NO es entidad territorial certificada en educación. El servicio educativo del municipio está a cargo de la Secretaría de Educación Departamental de Norte de Santander.
- Sin embargo, desde esta Secretaría municipal siempre existe la disposición para el acompañamiento y la articulación necesaria para el correcto funcionamiento del sistema educativo local.
- En lo concerniente a Cultura y Turismo, esta Secretaría SÍ es autónoma dentro de sus competencias municipales, buscando el bienestar común, el cumplimiento de la norma y las acciones que ayuden a cumplir el Plan de Desarrollo Municipal "Ocaña Renovada 2024-2027".
- El Secretario de despacho es Doiler Alfonso Sanjuán Sánchez.`

const INSTRUCCION_GENERAL = `El borrador NO debe incluir membrete, encabezado ni firma — solo el cuerpo del texto de la respuesta. Usa un tono institucional, respetuoso y ajustado a derecho. Escribe en español formal colombiano.`

const INSTRUCCIONES_TIPO = {
  tutela: `Genera un borrador de respuesta a esta acción de tutela. Ten en cuenta los términos legales colombianos (Decreto 2591 de 1991). Si el tema es de competencia de educación formal (matrículas, traslados, cupos), aclara que la competencia directa es de la Secretaría de Educación Departamental de Norte de Santander, pero que esta Secretaría municipal brinda acompañamiento y articulación. Cita la normativa aplicable.`,
  peticion: `Genera un borrador de respuesta a este derecho de petición (Ley 1755 de 2015). Identifica si el tema es de competencia municipal directa (cultura, turismo) o si requiere remisión/articulación con la Secretaría Departamental (educación). Responde de forma completa y respetuosa, citando la normativa aplicable.`,
  queja: `Genera un borrador de respuesta a esta queja ciudadana. Mantén un tono respetuoso e institucional. Indica las acciones de seguimiento o verificación que se tomarán desde la Secretaría.`,
}

const TIPO_LABEL = { tutela: 'acción de tutela', peticion: 'derecho de petición', queja: 'queja' }

function formatFecha(iso) {
  if (!iso) return 'sin fecha registrada'
  return new Date(iso).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const SUPABASE_URL      = process.env.SUPABASE_URL
  const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados' })
  }
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' })
  }

  // ── Auth: solo admin activo ────────────────────────────────────────────
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
    return res.status(403).json({ error: 'Solo administradores pueden generar borradores con IA' })
  }

  // ── Validación de entrada ───────────────────────────────────────────────
  const { tarea_id } = req.body ?? {}
  if (!tarea_id) {
    return res.status(400).json({ error: 'Campo requerido: tarea_id' })
  }

  const { data: tarea, error: tareaError } = await supabaseAdmin
    .from('tareas')
    .select('id, tipo, asunto, descripcion, remitente, fecha_recibido, fecha_limite')
    .eq('id', tarea_id)
    .single()

  if (tareaError || !tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  const instruccionTipo = INSTRUCCIONES_TIPO[tarea.tipo]
  if (!instruccionTipo) {
    return res.status(400).json({
      error: `No se generan borradores con IA para tareas de tipo "${tarea.tipo}" — solo tutela, petición o queja.`,
    })
  }

  const systemPrompt = `${CONTEXTO_INSTITUCIONAL}\n\n${instruccionTipo}\n\n${INSTRUCCION_GENERAL}`

  const mensajeUsuario = `Genera el borrador de respuesta para la siguiente ${TIPO_LABEL[tarea.tipo]}:

Asunto: ${tarea.asunto ?? '(sin asunto)'}
Remitente: ${tarea.remitente ?? '(sin remitente registrado)'}
Fecha de recibido: ${formatFecha(tarea.fecha_recibido)}
Fecha límite de respuesta: ${formatFecha(tarea.fecha_limite)}

Descripción / contenido de la solicitud:
${tarea.descripcion ?? '(sin descripción adicional)'}`

  // ── Llamada a Claude ─────────────────────────────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 2000,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: mensajeUsuario }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message ?? 'Error de Anthropic' })
    }

    const borrador = (data.content?.[0]?.text ?? '').trim()
    if (!borrador) {
      return res.status(500).json({ error: 'Claude no devolvió contenido' })
    }

    const { error: updateError } = await supabaseAdmin
      .from('tareas')
      .update({ borrador_ia: borrador })
      .eq('id', tarea_id)

    if (updateError) {
      return res.status(500).json({ error: 'Borrador generado pero no se pudo guardar: ' + updateError.message })
    }

    return res.status(200).json({ borrador })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
