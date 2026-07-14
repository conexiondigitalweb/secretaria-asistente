/**
 * Vercel Serverless Function — /api/enviar-notificaciones
 *
 * Disparado diariamente por un job de pg_cron (vía pg_net) en Supabase,
 * después de que generar_notificaciones_vencimiento() haya insertado los
 * registros pendientes en la tabla `notificaciones`.
 *
 * Protección: requiere header `Authorization: Bearer <CRON_SECRET>` —
 * la misma variable de entorno debe configurarse en Vercel y pasarse
 * como header en el job de pg_cron (ver SQL entregado aparte).
 *
 * Flujo:
 *   1. Lee notificaciones con enviada = false (join con tareas para el
 *      contenido del correo).
 *   2. Envía un correo por notificación vía Resend (un destinatario por
 *      llamada — Resend/nuestro flujo no agrupa varios `to` aquí a
 *      propósito, para poder marcar cada fila individualmente).
 *   3. Marca enviada = true + fecha_envio tras cada envío exitoso.
 *   4. Responde con el resumen { enviadas, fallidas, detalle }.
 *
 * No se llama a sí mismo ni a otras funciones serverless internamente
 * (Resend se invoca directo desde acá) — ver nota en CLAUDE.md sobre
 * por qué una función serverless no puede hacer fetch a otra en el
 * mismo despliegue.
 */

import { makeSupabase } from './_tokenUtils.js'

const APP_URL = 'https://secretaria-asistente.vercel.app'

const TIPO_LABEL = {
  tutela:    'Tutela',
  peticion:  'Petición',
  queja:     'Queja',
  solicitud: 'Solicitud',
  reunion:   'Reunión',
  tarea:     'Tarea',
  otro:      'Otro',
}

function formatFechaLarga(iso) {
  if (!iso) return 'Sin fecha límite'
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

/**
 * Construye asunto + HTML del correo según el tipo de notificación.
 * @param {'vencimiento_3d'|'vencimiento_hoy'} tipo
 * @param {object} tarea — { asunto, tipo, remitente, fecha_limite }
 */
function construirCorreo(tipo, tarea) {
  const esHoy = tipo === 'vencimiento_hoy'
  const asuntoCorreo = esHoy
    ? `🔴 Tarea vence HOY: ${tarea.asunto}`
    : `⚠️ Tarea próxima a vencer: ${tarea.asunto}`

  const color       = esHoy ? '#dc2626' : '#ea580c'
  const colorClaro  = esHoy ? '#fecaca' : '#fed7aa'
  const diasTexto   = esHoy ? 'Vence HOY' : 'Vence en 3 días hábiles'

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden">

    <div style="background:${color};padding:20px 24px">
      <p style="color:${colorClaro};font-size:12px;margin:0 0 4px">Secretaría de Educación, Cultura y Turismo</p>
      <h1 style="color:#fff;font-size:18px;margin:0">${esHoy ? '🔴 Tarea vence hoy' : '⚠️ Tarea próxima a vencer'}</h1>
    </div>

    <div style="padding:24px">
      <p style="color:#475569;font-size:14px;margin:0 0 20px">
        Recordatorio automático de SecretaríaOS sobre la siguiente solicitud:
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8;width:120px">Asunto</td>
          <td style="padding:8px 0;color:#1e293b;font-weight:600">${tarea.asunto ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Tipo</td>
          <td style="padding:8px 0;color:#1e293b">${TIPO_LABEL[tarea.tipo] ?? tarea.tipo ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Remitente</td>
          <td style="padding:8px 0;color:#1e293b">${tarea.remitente ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Fecha límite</td>
          <td style="padding:8px 0;color:${color};font-weight:600">
            ${formatFechaLarga(tarea.fecha_limite)}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#94a3b8">Estado</td>
          <td style="padding:8px 0;color:${color};font-weight:700">${diasTexto}</td>
        </tr>
      </table>

      <a href="${APP_URL}/tareas" style="display:inline-block;margin-top:20px;background:${color};
         color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px">
        Ver tarea en SecretaríaOS →
      </a>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px">
        Este mensaje fue generado automáticamente por SecretaríaOS — Secretaría de Educación,
        Cultura y Turismo · Municipio de Ocaña, Norte de Santander.
      </p>
    </div>
  </div>
</body>
</html>`

  return { asuntoCorreo, html }
}

async function enviarViaResend(apiKey, to, subject, html) {
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
    throw new Error(data?.message ?? 'Error de Resend')
  }
  return data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET no configurado en el servidor' })
  }

  const authHeader = req.headers['authorization'] ?? ''
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'No autorizado' })
  }

  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return res.status(500).json({ ok: false, error: 'RESEND_API_KEY no configurada en el servidor' })
  }

  let supabase
  try {
    supabase = makeSupabase()
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }

  const { data: pendientes, error: errQuery } = await supabase
    .from('notificaciones')
    .select('id, tarea_id, tipo, destinatario_email, tareas ( asunto, tipo, remitente, fecha_limite, estado )')
    .eq('enviada', false)

  if (errQuery) {
    return res.status(500).json({ ok: false, error: errQuery.message })
  }

  let enviadas = 0
  let fallidas = 0
  const detalle = []

  for (const notif of pendientes ?? []) {
    const tarea = notif.tareas
    // Defensivo: si la tarea ya no existe o fue resuelta después de generarse
    // la notificación (pero antes de que corriera este envío), no se envía.
    if (!tarea || tarea.estado === 'resuelto' || tarea.estado === 'archivado') {
      continue
    }

    try {
      const { asuntoCorreo, html } = construirCorreo(notif.tipo, tarea)
      await enviarViaResend(resendKey, notif.destinatario_email, asuntoCorreo, html)

      const { error: errUpdate } = await supabase
        .from('notificaciones')
        .update({ enviada: true, fecha_envio: new Date().toISOString() })
        .eq('id', notif.id)

      if (errUpdate) throw new Error(errUpdate.message)

      enviadas++
      detalle.push({ id: notif.id, destinatario: notif.destinatario_email, ok: true })
    } catch (e) {
      fallidas++
      detalle.push({ id: notif.id, destinatario: notif.destinatario_email, ok: false, error: e.message })
    }
  }

  return res.status(200).json({ ok: true, enviadas, fallidas, detalle })
}
