import { FileText, CheckCircle2, Clock, ExternalLink, Trash2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/cn'

const TIPO_LABEL = {
  plan_desarrollo: 'Plan de Desarrollo',
  plan_accion:     'Plan de Acción',
  normativa:       'Normativa',
  informe:         'Informe',
  otro:            'Otro',
}

const TIPO_COLOR = {
  plan_desarrollo: 'bg-blue-100 text-blue-700',
  plan_accion:     'bg-purple-100 text-purple-700',
  normativa:       'bg-amber-100 text-amber-700',
  informe:         'bg-teal-100 text-teal-700',
  otro:            'bg-slate-100 text-slate-600',
}

function formatFecha(iso) {
  return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(iso))
}

export default function ListaDocumentos({ documentos, loading, onEliminar }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-lg bg-surface-3 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!documentos.length) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <FileText className="h-10 w-10 text-text-muted mb-3 opacity-40" />
        <p className="text-sm font-medium text-text-secondary">Sin documentos cargados</p>
        <p className="text-xs text-text-muted mt-1">Usa el botón "Cargar documento" para subir el primer PDF</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {documentos.map(doc => (
        <li key={doc.id}
            className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-border
                       bg-surface hover:bg-surface-2 transition-colors">

          {/* Ícono estado */}
          <div className={cn('shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            doc.procesado ? 'bg-primary-light' : 'bg-amber-50')}>
            {doc.procesado
              ? <CheckCircle2 className="h-4 w-4 text-primary" />
              : <Clock className="h-4 w-4 text-amber-500" />}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary truncate">{doc.nombre}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                TIPO_COLOR[doc.tipo] ?? TIPO_COLOR.otro)}>
                {TIPO_LABEL[doc.tipo] ?? doc.tipo}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-text-muted">{formatFecha(doc.created_at)}</span>
              {doc.paginas && (
                <span className="text-xs text-text-muted">{doc.paginas} págs.</span>
              )}
              {doc.tamano_kb && (
                <span className="text-xs text-text-muted">
                  {doc.tamano_kb >= 1024
                    ? `${(doc.tamano_kb / 1024).toFixed(1)} MB`
                    : `${doc.tamano_kb} KB`}
                </span>
              )}
              {!doc.procesado && (
                <span className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Sin embedding
                </span>
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {doc.archivo_url && (
              <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer"
                 className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary-light transition-colors"
                 title="Ver PDF">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() => onEliminar?.(doc)}
              className="p-1.5 rounded-lg text-text-muted hover:text-destructive hover:bg-red-50 transition-colors"
              title="Eliminar documento"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
