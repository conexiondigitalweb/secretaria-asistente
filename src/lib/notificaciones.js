/**
 * notificaciones.js — Envío de notificaciones a funcionarios
 *
 * Usa Resend para correo (VITE_RESEND_API_KEY en .env.local).
 * El envío desde el cliente es válido para Fase 1/2; en Fase 3 mover
 * a Supabase Edge Function para no exponer la API key en el bundle.
 *
 * WhatsApp: genera link wa.me con mensaje prellenado (no requiere API).
 */

const RESEND_API = 'https://api.resend.com/emails'
const FROM_EMAIL = 'SecretaríaOS <notificaciones@ocanaturismo.com>'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFechaLarga(iso) {
  if (!iso) return 'Sin fecha límite'
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

/**
 * Normaliza número de teléfono colombiano para wa.me.
 * Ejemplo: "311 234-5678" → "57311234567"
 */
function normalizarTelefono(tel) {
  if (!tel) return null
  const limpio = tel.replace(/[\s\-().+]/g, '')
  // Si ya tiene código de país
  if (limpio.startsWith('57') && limpio.length >= 12) return limpio
  // Si empieza con 0 (ej: 0311...)
  if (limpio.startsWith('0')) return '57' + limpio.slice(1)
  return '57' + limpio
}

function encodeWA(texto) {
  return encodeURIComponent(texto)
}

async function enviarCorreo({ to, subject, html }) {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY
  if (!apiKey) {
    console.warn('[notificaciones] VITE_RESEND_API_KEY no configurada — correo omitido')
    return { ok: false, error: 'API key de Resend no configurada' }
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data?.message ?? 'Error Resend' }
    return { ok: true, id: data.id }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// ── Plantillas HTML ───────────────────────────────────────────────────────────

function htmlAsignacion(funcionario, tarea) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden">

    <div style="background:#1d4ed8;padding:20px 24px">
      <p style="color:#93c5fd;font-size:12px;margin:0 0 4px">Secretaría de Educación, Cultura y Turismo</p>
      <h1 style="color:#fff;font-size:18px;margin:0">Nueva tarea asignada</h1>
    </div>

    <div style="padding:24px">
      <p style="color:#475569;font-size:14px;margin:0 0 20px">
        Hola <strong>${funcionario.nombre}</strong>, se te ha asignado la siguiente solicitud:
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8;width:120px">Asunto</td>
          <td style="padding:8px 0;color:#1e293b;font-weight:600">${tarea.asunto ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Tipo</td>
          <td style="padding:8px 0;color:#1e293b">${tarea.tipo ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Remitente</td>
          <td style="padding:8px 0;color:#1e293b">${tarea.remitente ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Fecha límite</td>
          <td style="padding:8px 0;color:#dc2626;font-weight:600">
            ${formatFechaLarga(tarea.fecha_limite)}
          </td>
        </tr>
        ${tarea.descripcion ? `
        <tr>
          <td style="padding:8px 0;color:#94a3b8;vertical-align:top">Descripción</td>
          <td style="padding:8px 0;color:#1e293b">${tarea.descripcion}</td>
        </tr>` : ''}
      </table>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px">
        Este mensaje fue generado automáticamente por SecretaríaOS — Secretaría de Educación,
        Cultura y Turismo · Municipio de Ocaña, Norte de Santander.
      </p>
    </div>
  </div>
</body>
</html>`
}

function htmlDelegacion(funcionario, evento) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden">

    <div style="background:#7c3aed;padding:20px 24px">
      <p style="color:#c4b5fd;font-size:12px;margin:0 0 4px">Secretaría de Educación, Cultura y Turismo</p>
      <h1 style="color:#fff;font-size:18px;margin:0">Evento delegado</h1>
    </div>

    <div style="padding:24px">
      <p style="color:#475569;font-size:14px;margin:0 0 20px">
        Hola <strong>${funcionario.nombre}</strong>, se te ha delegado la representación en el siguiente evento:
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8;width:120px">Evento</td>
          <td style="padding:8px 0;color:#1e293b;font-weight:600">${evento.titulo ?? '—'}</td>
        </tr>
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Fecha</td>
          <td style="padding:8px 0;color:#1e293b">
            ${formatFechaLarga(evento.fecha_inicio)}
            ${evento.fecha_inicio ? ` — ${formatHora(evento.fecha_inicio)}` : ''}
          </td>
        </tr>
        ${evento.lugar ? `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:8px 0;color:#94a3b8">Lugar</td>
          <td style="padding:8px 0;color:#1e293b">${evento.lugar}</td>
        </tr>` : ''}
        ${evento.descripcion ? `
        <tr>
          <td style="padding:8px 0;color:#94a3b8;vertical-align:top">Notas</td>
          <td style="padding:8px 0;color:#1e293b">${evento.descripcion}</td>
        </tr>` : ''}
      </table>

      <p style="color:#64748b;font-size:12px;margin:24px 0 0;border-top:1px solid #f1f5f9;padding-top:16px">
        Este mensaje fue generado automáticamente por SecretaríaOS — Secretaría de Educación,
        Cultura y Turismo · Municipio de Ocaña, Norte de Santander.
      </p>
    </div>
  </div>
</body>
</html>`
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Notifica a un funcionario sobre una tarea asignada.
 * @param {object} funcionario  — { nombre, cargo, correo, whatsapp }
 * @param {object} tarea        — { asunto, tipo, remitente, fecha_limite, descripcion }
 * @returns {{ correo: {ok, error?}, waLink: string|null }}
 */
export async function notificarAsignacion(funcionario, tarea) {
  // Correo
  let correoResult = { ok: false, error: 'Sin correo registrado' }
  if (funcionario.correo) {
    correoResult = await enviarCorreo({
      to: funcionario.correo,
      subject: `📋 Tarea asignada: ${tarea.asunto}`,
      html: htmlAsignacion(funcionario, tarea),
    })
  }

  // WhatsApp link
  let waLink = null
  const tel = normalizarTelefono(funcionario.whatsapp ?? funcionario.telefono)
  if (tel) {
    const fechaStr = tarea.fecha_limite
      ? `Fecha límite: ${formatFechaLarga(tarea.fecha_limite)}.`
      : ''
    const msg =
      `Hola ${funcionario.nombre}, se te ha asignado la siguiente tarea en SecretaríaOS:\n\n` +
      `*Asunto:* ${tarea.asunto}\n` +
      `*Tipo:* ${tarea.tipo}\n` +
      (tarea.remitente ? `*Remitente:* ${tarea.remitente}\n` : '') +
      (fechaStr ? `*${fechaStr}*\n` : '') +
      (tarea.descripcion ? `\n${tarea.descripcion}` : '')
    waLink = `https://wa.me/${tel}?text=${encodeWA(msg)}`
  }

  return { correo: correoResult, waLink }
}

/**
 * Notifica a un funcionario sobre un evento delegado.
 * @param {object} funcionario  — { nombre, cargo, correo, whatsapp }
 * @param {object} evento       — { titulo, fecha_inicio, lugar, descripcion }
 * @returns {{ correo: {ok, error?}, waLink: string|null }}
 */
export async function notificarDelegacion(funcionario, evento) {
  // Correo
  let correoResult = { ok: false, error: 'Sin correo registrado' }
  if (funcionario.correo) {
    correoResult = await enviarCorreo({
      to: funcionario.correo,
      subject: `📅 Evento delegado: ${evento.titulo}`,
      html: htmlDelegacion(funcionario, evento),
    })
  }

  // WhatsApp link
  let waLink = null
  const tel = normalizarTelefono(funcionario.whatsapp ?? funcionario.telefono)
  if (tel) {
    const fechaStr = evento.fecha_inicio
      ? `${formatFechaLarga(evento.fecha_inicio)} ${formatHora(evento.fecha_inicio)}`
      : ''
    const msg =
      `Hola ${funcionario.nombre}, quedas delegado en el siguiente evento:\n\n` +
      `*Evento:* ${evento.titulo}\n` +
      (fechaStr ? `*Fecha:* ${fechaStr}\n` : '') +
      (evento.lugar ? `*Lugar:* ${evento.lugar}\n` : '') +
      (evento.descripcion ? `\n${evento.descripcion}` : '')
    waLink = `https://wa.me/${tel}?text=${encodeWA(msg)}`
  }

  return { correo: correoResult, waLink }
}
