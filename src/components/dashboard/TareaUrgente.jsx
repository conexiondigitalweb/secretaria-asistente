import { diasHabilesRestantes, formatFecha, esHoy, formatDiaCorto, esEstadoFinal } from '../../lib/utils'

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
  // Tarea resuelta (o archivada) — nunca debe mostrar indicador de vencimiento,
  // aunque en la práctica Dashboard ya filtra estas tareas antes de llegar aquí.
  const esFinal = esEstadoFinal(tarea.estado)
  const dias = esFinal ? null : diasHabilesRestantes(tarea.fecha_limite)

  const hoyExacto = !esFinal && esHoy(tarea.fecha_limite)
  let diasColor = 'text-slate-500'
  let diasLabel = esFinal
    ? '✓ Resuelto'
    : dias === null
      ? '—'
      : dias < 0
        ? `Venció hace ${Math.abs(dias)}d hábiles`
        : hoyExacto
          ? 'Vence hoy'
          : dias === 0
            ? `0h · Vence ${formatDiaCorto(tarea.fecha_limite)}`
            : `${dias}d hábiles`

  if (esFinal) diasColor = 'text-green-600 font-medium'
  else if (dias !== null && (dias < 0 || hoyExacto)) diasColor = 'text-red-600 font-semibold'
  else if (dias !== null && dias === 0) diasColor = 'text-orange-500 font-semibold' // 0h pero no hoy
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
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-slate-800 font-medium truncate">{tarea.asunto}</p>
          {tarea.origen === 'correo' && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full
                             bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">
              📧
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Recibido {formatFecha(tarea.fecha_recibido)}</p>
      </div>
      <span className={`text-xs shrink-0 mt-1 ${diasColor}`}>{diasLabel}</span>
    </div>
  )
}
