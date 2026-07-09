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
- informativo: boletines, circulares, notificaciones automáticas, newsletters
- spam: publicidad, correos no solicitados, phishing

Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto adicional, sin bloques de código.`

/**
 * Clasifica un correo usando Claude.
 *
 * @param {{ asunto: string, cuerpo: string, remitente: string }} correo
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
export async function clasificarCorreo({ asunto, cuerpo, remitente }, apiKey) {
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

REMITENTE: ${remitente ?? '(desconocido)'}
ASUNTO: ${asunto ?? '(sin asunto)'}
CUERPO:
${(cuerpo ?? '').slice(0, 4000)}

Responde con exactamente este JSON (todos los campos requeridos):
{
  "clasificacion": "tutela" | "peticion" | "queja" | "convocatoria" | "informativo" | "spam",
  "confianza": número entre 0.0 y 1.0,
  "numero_radicado": "número si aparece explícitamente en el correo" o null,
  "fecha_limite": "YYYY-MM-DD si el correo menciona una fecha límite de respuesta" o null,
  "lugar": "lugar de la reunión si es convocatoria" o null,
  "fecha_hora_reunion": "ISO 8601 con hora si es convocatoria con fecha explícita" o null,
  "resumen": "máximo 200 caracteres describiendo el contenido del correo"
}

Reglas estrictas:
- "tutela": solo si menciona acción de tutela, fallo, juzgado, impugnación
- "peticion": solicitud formal con derecho de petición o radicado
- "queja": inconformidad ciudadana sobre un servicio de la Secretaría
- "convocatoria": reunión, capacitación, socialización, mesa de trabajo, invitación a acto oficial, citación o cualquier correo que invite a asistir a algo — aunque no incluya fecha explícita
- Si el correo pide respuesta en N días, ese N va en fecha_limite calculada desde hoy
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
      const CATEGORIAS = ['tutela','peticion','queja','convocatoria','informativo','spam']
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
          const CATEGORIAS = ['tutela','peticion','queja','convocatoria','informativo','spam']
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

  const { asunto, cuerpo, remitente } = req.body ?? {}
  if (!asunto && !cuerpo) {
    return res.status(400).json({ error: 'Se requiere asunto o cuerpo' })
  }

  const resultado = await clasificarCorreo({ asunto, cuerpo, remitente }, ANTHROPIC_API_KEY)
  return res.status(200).json(resultado)
}
