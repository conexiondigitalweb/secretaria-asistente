/**
 * Vercel Serverless Function — /api/generate-embedding
 *
 * Genera un embedding de 1536 dimensiones usando Voyage AI voyage-large-2.
 * Voyage AI es el proveedor oficial de embeddings recomendado por Anthropic.
 *
 * Variables de entorno requeridas en Vercel:
 *   VOYAGE_API_KEY  — obtener en https://www.voyageai.com (tier gratuito: 50M tokens/mes)
 *
 * Body: { text: string, input_type?: 'document' | 'query' }
 * Respuesta: { embedding: number[] }   (1536 dimensiones)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'VOYAGE_API_KEY no configurada en el servidor' })
  }

  const { text, input_type = 'document' } = req.body ?? {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Campo "text" requerido' })
  }

  // Voyage AI tiene límite de ~16K tokens (~64K chars). Truncamos con margen.
  const textTruncado = text.slice(0, 60000)

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'voyage-large-2',   // 1536 dims — coincide exactamente con el schema
        input: textTruncado,
        input_type,               // 'document' al indexar, 'query' al buscar
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.detail ?? data?.message ?? 'Error de Voyage AI',
      })
    }

    return res.status(200).json({ embedding: data.data[0].embedding })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
