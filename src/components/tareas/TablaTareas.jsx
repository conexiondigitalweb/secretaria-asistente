import Badge from '../ui/Badge'
import { diasRestantes, formatFecha } from '../../lib/utils'

const TIPO_LABEL = {
  tutela: 'Tutela', peticion: 'Petición', queja: 'Queja', solicitud: 'Solicitud',
  reunion: 'Reunión', tarea: 'Tarea', otro: 'Otro',
}

function DiasRestantes({ fecha_limite }) {
  const dias = diasRestantes(fecha_limite)
  if (dias === null) return <span className="text-slate-400 text-xs">—</span>
  const label = dias === 0 ? 'Hoy' : dias < 0 ? `Hace ${Math.abs(dias)}d` : `${dias}d`
  const color = dias < 0 ? 'text-red-600 font-semibold' : dias === 0 ? 'text-red-500 font-semibold' : dias <= 3 ? 'text-orange-500 font-medium' : 'text-slate-500'
  return <span className={`text-xs ${color}`}>{label}</span>
}

/**
 * @param {{ tareas: object[], onSelect: (t: object) => void }} props
 */
export default function TablaTareas({ tareas, onSelect }) {
  if (tareas.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">📋</p>
        <p className="text-sm">No hay tareas con los filtros actuales</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {['Tipo', 'Asunto', 'Remitente', 'Recibido', 'Límite', 'Estado', 'Prioridad'].map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 px-3 py-2 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tareas.map(t => (
            <tr
              key={t.id}
              onClick={() => onSelect(t)}
              className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="px-3 py-3">
                <Badge value={t.tipo} />
              </td>
              <td className="px-3 py-3 max-w-xs">
                <p className="font-medium text-slate-800 truncate">{t.asunto}</p>
              </td>
              <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{t.remitente || '—'}</td>
              <td className="px-3 py-3 text-slate-500 whitespace-nowrap text-xs">{formatFecha(t.fecha_recibido)}</td>
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-slate-500">{formatFecha(t.fecha_limite)}</span>
                  <DiasRestantes fecha_limite={t.fecha_limite} />
                </div>
              </td>
              <td className="px-3 py-3">
                <Badge value={t.estado} />
              </td>
              <td className="px-3 py-3">
                <Badge value={t.prioridad} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
