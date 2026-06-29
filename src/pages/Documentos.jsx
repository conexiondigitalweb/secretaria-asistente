import { useState } from 'react'
import { Plus, FileText, MessageSquare } from 'lucide-react'
import { useDocumentos } from '../hooks/useDocumentos'
import ListaDocumentos from '../components/documentos/ListaDocumentos'
import FormDocumento   from '../components/documentos/FormDocumento'
import ChatConsulta    from '../components/documentos/ChatConsulta'
import { cn } from '../lib/cn'

export default function Documentos() {
  const { documentos, loading, crearDocumento, eliminarDocumento, buscarSimilares, refetch } = useDocumentos()
  const [vista, setVista]           = useState('lista')   // 'lista' | 'chat'
  const [mostrarForm, setMostrarForm] = useState(false)
  const [eliminando, setEliminando]   = useState(null)
  const [errorElim, setErrorElim]     = useState(null)

  const procesados = documentos.filter(d => d.procesado && d.vigente)

  async function handleEliminar(doc) {
    if (!confirm(`¿Eliminar "${doc.nombre}"? Esta acción no se puede deshacer.`)) return
    setEliminando(doc.id)
    setErrorElim(null)
    try {
      await eliminarDocumento(doc.id, doc.archivo_url)
    } catch (err) {
      setErrorElim(err.message)
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-border bg-surface">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Documentos institucionales</h1>
            <p className="text-xs text-text-muted mt-0.5">
              {documentos.length} documento{documentos.length !== 1 ? 's' : ''} ·{' '}
              {procesados.length} con embedding
            </p>
          </div>

          {vista === 'lista' && !mostrarForm && (
            <button
              onClick={() => setMostrarForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white
                         text-sm font-medium hover:bg-primary-hover transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Cargar documento</span>
              <span className="sm:hidden">Cargar</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-3 rounded-lg p-1 w-fit">
          {[
            { id: 'lista', label: 'Documentos', icon: FileText },
            { id: 'chat',  label: 'Consultar',  icon: MessageSquare },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setVista(id); setMostrarForm(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                vista === id
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Cuerpo ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">

        {/* Vista: lista + formulario */}
        {vista === 'lista' && (
          <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

            {/* Formulario de carga */}
            {mostrarForm && (
              <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
                <h2 className="text-sm font-semibold text-text-primary mb-4">Nuevo documento</h2>
                <FormDocumento
                  onCreado={(doc) => {
                    refetch()
                    setMostrarForm(false)
                  }}
                  onCancelar={() => setMostrarForm(false)}
                />
              </div>
            )}

            {/* Error al eliminar */}
            {errorElim && (
              <p className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                Error al eliminar: {errorElim}
              </p>
            )}

            {/* Lista */}
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4 sm:p-5">
              {!mostrarForm && documentos.length > 0 && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-text-primary">Documentos cargados</h2>
                  <span className="text-xs text-text-muted px-2 py-0.5 bg-surface-3 rounded-full">
                    {documentos.length}
                  </span>
                </div>
              )}
              <ListaDocumentos
                documentos={documentos}
                loading={loading || !!eliminando}
                onEliminar={handleEliminar}
              />
            </div>
          </div>
        )}

        {/* Vista: chat */}
        {vista === 'chat' && (
          <div className="h-full" style={{ height: 'calc(100vh - 140px)' }}>
            <div className="max-w-3xl mx-auto h-full flex flex-col bg-surface rounded-none
                            sm:rounded-xl sm:border sm:border-border sm:shadow-sm sm:m-4 sm:h-auto"
                 style={{ height: '100%' }}>
              <ChatConsulta
                buscarSimilares={buscarSimilares}
                hayDocumentos={procesados.length > 0}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
