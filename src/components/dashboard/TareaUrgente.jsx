import { diasRestantes, formatFecha } from '../../lib/utils'

const TIPO_LABEL = {
  tutela:   'Tutela',
  peticion: 'Petición',
  queja:    'Queja',
  solicitud:'Solicitud',
  reunion:  'Reunión',
  tarea:    'Tarea',
  otro:     'Otro',
}

const PRIORIDAD_COLOR = {
  critica: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-yellow-100 text-yellow-700',
  baja:    'bg-slate-100 text-slate-600',
}

/**
 * @param {{ tarea: object }} props
 */
export default function TareaUrgente({ tarea }) {
  const dias = diasRestantes(tarea.fecha_limite)

  let diasColor = 'text-slate-500'
  let diasLabel = dias === null ? '—' : dias === 0 ? 'Vence hoy' : dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d restantes`
  if (dias !== null && dias <= 0) diasColor = 'text-red-600 font-semibold'
  else if (dias !== null && dias <= 3) diasColor = 'text-orange-500 font-medium'

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_COLOR[tarea.prioridad] ?? PRIORIDAD_COLOR.baja}`}>
            {TIPO_LABEL[tarea.tipo] ?? tarea.tipo}
          </span>
          <span className="text-xs text-slate-400">{tarea.remitente}</span>
        </div>
        <p className="text-sm text-slate-800 font-medium truncate">{tarea.asunto}</p>
        <p className="text-xs text-slate-400 mt-0.5">Recibido {formatFecha(tarea.fecha_recibido)}</p>
      </div>
      <span className={`text-xs shrink-0 mt-1 ${diasColor}`}>{diasLabel}</span>
    </div>
  )
}
