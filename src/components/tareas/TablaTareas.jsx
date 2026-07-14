import Badge from '../ui/Badge'
import { diasHabilesRestantes, formatFecha, esHoy, formatDiaCorto, esEstadoFinal } from '../../lib/utils'
import { cn } from '../../lib/cn'

function DiasHabiles({ fecha_limite, estado }) {
  // Tarea resuelta (o archivada) — ya no aplica indicador de vencimiento.
  if (esEstadoFinal(estado)) {
    return <span className="text-xs text-green-600 font-medium">✓ Resuelto</span>
  }
  const dias = diasHabilesRestantes(fecha_limite)
  if (dias === null) return <span className="text-text-muted text-xs">—</span>
  const hoyExacto = esHoy(fecha_limite)
  const label = dias < 0
    ? `Hace ${Math.abs(dias)}d háb.`
    : hoyExacto
      ? 'Hoy'
      : dias === 0
        ? `0h · ${formatDiaCorto(fecha_limite)}`
        : `${dias}d háb.`
  const color = dias < 0 || hoyExacto
    ? 'text-red-600 font-semibold'
    : dias === 0
      ? 'text-orange-500 font-semibold'
      : dias <= 3
        ? 'text-orange-500 font-medium'
        : 'text-text-muted'
  return <span className={cn('text-xs', color)}>{label}</span>
}

/**
 * @param {{ tareas: object[], onSelect: (t: object) => void }} props
 */
export default function TablaTareas({ tareas, onSelect }) {
  if (tareas.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">No hay tareas con los filtros actuales</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {['Tipo', 'Asunto', 'Remitente', 'Recibido', 'Límite', 'Estado', 'Prioridad'].map(h => (
              <th
                key={h}
                className="text-left text-[11px] font-semibold text-text-muted uppercase tracking-wide
                           px-4 py-3 whitespace-nowrap first:pl-5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tareas.map(t => (
            <tr
              key={t.id}
              onClick={() => onSelect(t)}
              className="hover:bg-primary-lighter cursor-pointer transition-colors group"
            >
              <td className="px-4 py-3.5 first:pl-5">
                <Badge value={t.tipo} />
              </td>
              <td className="px-4 py-3.5 max-w-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                    {t.asunto}
                  </p>
                  {t.origen === 'correo' && (
                    <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full
                                     bg-blue-50 text-blue-600 border border-blue-100 whitespace-nowrap">
                      📧 Desde correo
                    </span>
                  )}
                </div>
                {t.radicado && (
                  <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">{t.radicado}</p>
                )}
              </td>
              <td className="px-4 py-3.5 text-text-secondary whitespace-nowrap text-xs">
                {t.remitente || <span className="text-text-muted">—</span>}
              </td>
              <td className="px-4 py-3.5 text-text-muted whitespace-nowrap text-xs">
                {formatFecha(t.fecha_recibido)}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-text-secondary">{formatFecha(t.fecha_limite)}</span>
                  <DiasHabiles fecha_limite={t.fecha_limite} estado={t.estado} />
                </div>
              </td>
              <td className="px-4 py-3.5"><Badge value={t.estado} /></td>
              <td className="px-4 py-3.5"><Badge value={t.prioridad} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
