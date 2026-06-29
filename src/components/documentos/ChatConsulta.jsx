/**
 * ChatConsulta — RAG chat sobre documentos institucionales
 *
 * Flujo:
 *  1. Usuario escribe pregunta
 *  2. /api/generate-embedding (input_type: 'query') → embedding de la pregunta
 *  3. Supabase RPC buscar_documentos_similares → fragmentos relevantes
 *  4. /api/chat-document (pregunta + contexto) → respuesta de Claude
 */
import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Bot, User, BookOpen, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

export default function ChatConsulta({ buscarSimilares, hayDocumentos }) {
  const [mensajes, setMensajes]   = useState([])
  const [pregunta, setPregunta]   = useState('')
  const [cargando, setCargando]   = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  async function handleEnviar(e) {
    e.preventDefault()
    const q = pregunta.trim()
    if (!q || cargando) return

    const msgUsuario = { role: 'user', texto: q, ts: Date.now() }
    setMensajes(prev => [...prev, msgUsuario])
    setPregunta('')
    setCargando(true)

    try {
      // 1 — Embedding de la pregunta
      const embRes = await fetch('/api/generate-embedding', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: q, input_type: 'query' }),
      })
      if (!embRes.ok) throw new Error('Error generando embedding de la consulta')
      const { embedding } = await embRes.json()

      // 2 — Búsqueda semántica en Supabase
      const similares = await buscarSimilares(embedding, 3, 0.25)

      // 3 — RAG con Claude
      const chatRes = await fetch('/api/chat-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pregunta: q, contexto: similares }),
      })
      if (!chatRes.ok) throw new Error('Error consultando al asistente')
      const { respuesta, fuentes } = await chatRes.json()

      setMensajes(prev => [...prev, {
        role:     'assistant',
        texto:    respuesta,
        fuentes:  fuentes ?? [],
        similares,
        ts:       Date.now(),
      }])

    } catch (err) {
      setMensajes(prev => [...prev, {
        role:  'error',
        texto: err.message,
        ts:    Date.now(),
      }])
    } finally {
      setCargando(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviar(e)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Historial ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {mensajes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-text-secondary">Asistente institucional</p>
            {hayDocumentos ? (
              <p className="text-xs text-text-muted max-w-xs">
                Pregunta sobre el Plan de Desarrollo, decretos, informes u otros documentos cargados.
                El asistente buscará la respuesta en los documentos disponibles.
              </p>
            ) : (
              <p className="text-xs text-amber-600 max-w-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aún no hay documentos procesados. Carga al menos un PDF para habilitar las consultas.
              </p>
            )}
          </div>
        )}

        {mensajes.map(msg => (
          <div key={msg.ts}
               className={cn('flex gap-2.5', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>

            {/* Avatar */}
            <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              msg.role === 'user'
                ? 'bg-primary text-white'
                : msg.role === 'error'
                  ? 'bg-red-100 text-destructive'
                  : 'bg-primary-light text-primary')}>
              {msg.role === 'user'
                ? <User className="h-3.5 w-3.5" />
                : msg.role === 'error'
                  ? <AlertCircle className="h-3.5 w-3.5" />
                  : <Bot className="h-3.5 w-3.5" />}
            </div>

            {/* Burbuja */}
            <div className={cn('max-w-[80%] space-y-1.5',
              msg.role === 'user' ? 'items-end' : 'items-start', 'flex flex-col')}>
              <div className={cn('px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-tr-sm'
                  : msg.role === 'error'
                    ? 'bg-red-50 text-destructive border border-red-200 rounded-tl-sm'
                    : 'bg-surface-2 text-text-primary border border-border rounded-tl-sm')}>
                {msg.texto}
              </div>

              {/* Fuentes */}
              {msg.role === 'assistant' && msg.similares?.length > 0 && (
                <div className="flex flex-wrap gap-1 px-1">
                  {msg.similares.map((s, i) => (
                    <span key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-primary-light text-primary font-medium">
                      {s.nombre}
                    </span>
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && msg.similares?.length === 0 && (
                <span className="text-[10px] text-text-muted px-1">
                  Sin documentos relacionados encontrados
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Indicador de carga */}
        {cargando && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary-light flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-surface-2 border border-border">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input ─────────────────────────────────────────────── */}
      <div className="border-t border-border p-3">
        <form onSubmit={handleEnviar} className="flex gap-2">
          <textarea
            value={pregunta}
            onChange={e => setPregunta(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={hayDocumentos
              ? '¿Qué dice el Plan de Desarrollo sobre educación?'
              : 'Carga documentos para habilitar consultas…'}
            disabled={cargando || !hayDocumentos}
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border-input bg-surface
                       text-text-primary placeholder:text-text-muted resize-none
                       focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
          <button
            type="submit"
            disabled={cargando || !pregunta.trim() || !hayDocumentos}
            className="p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {cargando
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </button>
        </form>
        <p className="text-[10px] text-text-muted mt-1.5 px-1">
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  )
}
