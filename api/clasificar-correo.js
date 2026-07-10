/**
 * Clasificación de correos con Claude
 *
 * Exporta `clasificarCorreo()` para uso directo desde gmail-sync.js
 * (las serverless functions no pueden llamarse entre sí por HTTP).
 *
 * También exporta un handler HTTP para pruebas directas:
 *   POST /api/clasificar-correo
 *   Body: { asunto, cuerpo, remitente }
 */

const SYSTEM_PROMPT = `Eres el clasificador de correos de la Secretaría de Educación, Cultura y Turismo del Municipio de Ocaña, Norte de Santander, Colombia.

Tu única tarea es clasificar correos electrónicos entrantes y extraer información estructurada relevante para el despacho del Secretario.

Categorías válidas:
- tutela: acción de tutela, derechos fundamentales, juzgado, demandante, fallo judicial
- peticion: derecho de petición formal de ciudadano, entidad pública o privada
- queja: queja, reclamo, inconformidad de ciudadano sobre un servicio
- convocatoria: reunión, evento, capacitación, socialización, mesa de trabajo, invitación a acto oficial, citación, o cualquier correo que invite a asistir a algo — aunque no incluya fecha explícita en el texto
- factura: facturas de servicios públicos, cobros, cuentas de cobro, estados de cuenta, recibos de pago, extractos bancarios
- informativo: boletines, circulares, notificaciones automáticas, newsletters
- spam: publicidad, correos no solicitados, phishing

IMPORTANTE: las facturas de servicios públicos (agua, luz, gas, internet, teléfono) son SIEMPRE categoría "factura", NUNCA "spam" — aunque el remitente sea automatizado o el correo tenga formato de plantilla/HTML comercial. Gmail suele marcar estos correos como spam por error; tu criterio debe ser independiente de esa etiqueta.

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto adicional, sin bloques de código.`

/**
 * Clasifica un correo usando Claude.
 *
 * @param {{ asunto: string, cuerpo: string, remitente: string, fecha_correo?: string }} correo
 * @param {string} apiKey  ANTHROPIC_API_KEY
 * @returns {Promise<{
 *   clasificacion: string,
 *   confianza: number,
 *   numero_radicado: string|null,
 *   fecha_limite: string|null,
 *   lugar: string|null,
 *   fecha_hora_reunion: string|null,
 *   resumen: string
 * }>}
 */
export async function clasificarCorreo({ asunto, cuerpo, remitente, fecha_correo }, apiKey) {
  const FALLBACK = {
    clasificacion:    'informativo',
    confianza:        0,
    numero_radicado:  null,
    fecha_limite:     null,
    lugar:            null,
    fecha_hora_reunion: null,
    resumen:          (asunto ?? '').slice(0, 200),
  }

  const prompt = `Clasifica este correo de la Secretaría de Educación de Ocaña.

FECHA DEL CORREO: ${fecha_correo ?? '(desconocida — no asumas una fecha, usa null en campos de fecha relativa que no puedas resolver)'}
La zona horaria del destinatario es America/Bogota (UTC-5).
Usa la fecha del correo como referencia para resolver fechas relativas ("próximo lunes", "el 15 de marzo", "en 8 días", etc.) — NO uses ninguna otra fecha de referencia. Todas las fechas y horas que devuelvas deben incluir el offset -05:00 (ej: "2026-07-15T14:00:00-05:00").

REMITENTE: ${remitente ?? '(desconocido)'}
ASUNTO: ${asunto ?? '(sin asunto)'}
CUERPO:
${(cuerpo ?? '').slice(0, 4000)}

Responde con exactamente este JSON (todos los campos requeridos):
{
  "clasificacion": "tutela" | "peticion" | "queja" | "convocatoria" | "factura" | "informativo" | "spam",
  "confianza": número entre 0.0 y 1.0,
  "numero_radicado": "número si aparece explícitamente en el correo" o null,
  "fecha_limite": "YYYY-MM-DD si el correo menciona una fecha límite de respuesta (calculada respecto a FECHA DEL CORREO, no a hoy)" o null,
  "lugar": "lugar de la reunión si es convocatoria" o null,
  "fecha_hora_reunion": "ISO 8601 con offset -05:00 si es convocatoria con fecha explícita" o null,
  "resumen": "máximo 200 caracteres describiendo el contenido del correo"
}

Reglas estrictas:
- "tutela": solo si menciona acción de tutela, fallo, juzgado, impugnación
- "peticion": solicitud formal con derecho de petición o radicado
- "queja": inconformidad ciudadana sobre un servicio de la Secretaría
- "convocatoria": reunión, capacitación, socialización, mesa de trabajo, invitación a acto oficial, citación o cualquier correo que invite a asistir a algo — aunque no incluya fecha explícita
- "factura": facturas de servicios públicos (agua, luz, gas, internet, teléfono), cobros, cuentas de cobro, estados de cuenta, recibos de pago o extractos bancarios — SIEMPRE "factura", nunca "spam", sin importar el formato o remitente automatizado
- Si el correo pide respuesta en N días, ese N va en fecha_limite calculada desde FECHA DEL CORREO (no desde hoy)
- numero_radicado: solo números de radicado, expediente o proceso visibles en el texto`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-5',
        max_tokens: 512,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[clasificar-correo] Error API Anthropic:', err)
      return FALLBACK
    }

    const data  = await res.json()
    const texto = data.content?.[0]?.text ?? ''

    // Strip de bloques ```json``` si el modelo los agrega
    const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      const parsed = JSON.parse(limpio)

      // Validar y sanitizar campos
      const CATEGORIAS = ['tutela','peticion','queja','convocatoria','factura','informativo','spam']
      return {
        clasificacion:    CATEGORIAS.includes(parsed.clasificacion) ? parsed.clasificacion : 'informativo',
        confianza:        typeof parsed.confianza === 'number'
                            ? Math.min(1, Math.max(0, parsed.confianza))
                            : 0,
        numero_radicado:  parsed.numero_radicado ?? null,
        fecha_limite:     parsed.fecha_limite ?? null,
        lugar:            parsed.lugar ?? null,
        fecha_hora_reunion: parsed.fecha_hora_reunion ?? null,
        resumen:          (parsed.resumen ?? '').slice(0, 200),
      }
    } catch {
      // Intentar extraer JSON de una respuesta con texto extra
      const match = limpio.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          const CATEGORIAS = ['tutela','peticion','queja','convocatoria','factura','informativo','spam']
          return {
            clasificacion:    CATEGORIAS.includes(parsed.clasificacion) ? parsed.clasificacion : 'informativo',
            confianza:        typeof parsed.confianza === 'number'
                                ? Math.min(1, Math.max(0, parsed.confianza))
                                : 0,
            numero_radicado:  parsed.numero_radicado ?? null,
            fecha_limite:     parsed.fecha_limite ?? null,
            lugar:            parsed.lugar ?? null,
            fecha_hora_reunion: parsed.fecha_hora_reunion ?? null,
            resumen:          (parsed.resumen ?? '').slice(0, 200),
          }
        } catch { /* fall through */ }
      }
      console.error('[clasificar-correo] JSON inválido de Claude:', texto.slice(0, 300))
      return FALLBACK
    }
  } catch (err) {
    console.error('[clasificar-correo] Error de red:', err.message)
    return FALLBACK
  }
}

// ── Handler HTTP (para pruebas directas) ─────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })
  }

  const { asunto, cuerpo, remitente, fecha_correo } = req.body ?? {}
  if (!asunto && !cuerpo) {
    return res.status(400).json({ error: 'Se requiere asunto o cuerpo' })
  }

  const resultado = await clasificarCorreo({ asunto, cuerpo, remitente, fecha_correo }, ANTHROPIC_API_KEY)
  return res.status(200).json(resultado)
}
