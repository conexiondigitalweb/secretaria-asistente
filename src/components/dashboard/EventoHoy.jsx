import { formatFecha } from '../../lib/utils'

const TIPO_COLOR = {
  reunion:      'bg-primary-light text-primary',
  compromiso:   'bg-purple-100 text-purple-700',
  recordatorio: 'bg-yellow-100 text-yellow-700',
  evento:       'bg-green-100 text-green-700',
}

/**
 * @param {{ evento: object }} props
 */
export default function EventoHoy({ evento }) {
  const hora = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
    .format(new Date(evento.fecha_inicio))

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="text-center w-12 shrink-0">
        <span className="text-xs font-semibold text-slate-600">{hora}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_COLOR[evento.tipo] ?? 'bg-slate-100 text-slate-600'}`}>
            {evento.tipo}
          </span>
          {evento.lugar && <span className="text-xs text-slate-400 truncate">{evento.lugar}</span>}
        </div>
        <p className="text-sm text-slate-800 font-medium">{evento.titulo}</p>
      </div>
    </div>
  )
}
