/**
 * Vercel Serverless Function — /api/chat-document
 *
 * RAG: recibe una pregunta + contexto de documentos similares →
 * Claude claude-sonnet-4-5 genera la respuesta citando la fuente.
 *
 * Variables de entorno requeridas en Vercel:
 *   ANTHROPIC_API_KEY  — API key de Anthropic (sin prefijo VITE_)
 *
 * Body:
 *   {
 *     pregunta: string,
 *     contexto: [{ nombre: string, tipo: string, contenido: string, similitud: number }]
 *   }
 *
 * Respuesta: { respuesta: string, fuentes: string[] }
 */

const SYSTEM_PROMPT = `Eres el asistente institucional de la Secretaría de Educación, Cultura y Turismo del Municipio de Ocaña, Norte de Santander, Colombia.

Tu función es responder preguntas basándote ÚNICAMENTE en los documentos institucionales que se te proporcionan como contexto.

Reglas:
1. Responde en español formal y preciso.
2. Cita siempre el documento de donde proviene la información (ej: "Según el Plan de Desarrollo...").
3. Si la respuesta no está en los documentos, di exactamente: "No encontré información sobre esto en los documentos disponibles."
4. No inventes datos ni extrapoles más allá de lo que dicen los documentos.
5. Sé conciso pero completo. Usa listas cuando facilite la lectura.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor' })
  }

  const { pregunta, contexto = [] } = req.body ?? {}
  if (!pregunta) {
    return res.status(400).json({ error: 'Campo "pregunta" requerido' })
  }

  // Construir el bloque de contexto documental
  const bloqueContexto = contexto.length > 0
    ? contexto.map((doc, i) =>
        `--- DOCUMENTO ${i + 1}: ${doc.nombre} (${doc.tipo}) ---\n${doc.contenido?.slice(0, 8000) ?? '(sin contenido)'}`
      ).join('\n\n')
    : 'No se encontraron documentos relevantes para esta pregunta.'

  const mensajeUsuario =
    `DOCUMENTOS DISPONIBLES:\n\n${bloqueContexto}\n\n` +
    `PREGUNTA: ${pregunta}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: mensajeUsuario }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message ?? 'Error de Anthropic',
      })
    }

    const respuesta = data.content?.[0]?.text ?? ''
    const fuentes = contexto.map(d => d.nombre)

    return res.status(200).json({ respuesta, fuentes })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
