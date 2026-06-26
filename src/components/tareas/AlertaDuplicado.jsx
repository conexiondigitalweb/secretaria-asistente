import { formatFecha } from '../../lib/utils'
import Badge from '../ui/Badge'

/**
 * Alerta que se muestra cuando se detecta una tutela con el mismo radicado.
 *
 * @param {{
 *   tareaExistente: object,
 *   radicado: string,
 *   onVincular: () => void,
 *   onCrearNueva: () => void,
 *   onCancelar: () => void,
 *   vinculando: boolean,
 *   correoId?: string,
 * }} props
 */
export default function AlertaDuplicado({
  tareaExistente,
  radicado,
  onVincular,
  onCrearNueva,
  onCancelar,
  vinculando,
  correoId,
}) {
  const t = tareaExistente

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera de alerta */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <span className="text-2xl shrink-0">⚠️</span>
        <div>
          <p className="text-sm font-semibold text-amber-800">Ya existe una tutela con este radicado</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Radicado: <span className="font-mono font-semibold">{radicado}</span>
          </p>
        </div>
      </div>

      {/* Tarjeta de tarea existente */}
      <div className="border border-slate-200 rounded-lg p-4 flex flex-col gap-2 bg-slate-50">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Tarea existente</p>
        <p className="text-sm font-semibold text-slate-800">{t.asunto}</p>
        {t.remitente && (
          <p className="text-xs text-slate-500">Remitente: {t.remitente}</p>
        )}
        <div className="flex gap-2 flex-wrap mt-1">
          <Badge value={t.estado} />
          <Badge value={t.prioridad} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div>
            <p className="text-xs text-slate-400">Recibido</p>
            <p className="text-xs text-slate-600">{formatFecha(t.fecha_recibido)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Fecha límite</p>
            <p className="text-xs text-slate-600">{formatFecha(t.fecha_limite)}</p>
          </div>
        </div>
        {t.correo_id && (
          <p className="text-xs text-slate-400 mt-1">Ya tiene un correo vinculado.</p>
        )}
      </div>

      {/* Opciones */}
      <div className="flex flex-col gap-2">
        {/* Opción 1: vincular correo (solo si hay correoId y la tarea no tiene uno ya) */}
        {correoId && !t.correo_id && (
          <button
            onClick={onVincular}
            disabled={vinculando}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {vinculando ? 'Vinculando…' : '🔗 Vincular este correo a la tarea existente'}
          </button>
        )}

        {/* Opción 2: crear nueva de todas formas */}
        <button
          onClick={onCrearNueva}
          className="w-full py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
        >
          Crear nueva tarea de todas formas
        </button>

        {/* Opción 3: cancelar */}
        <button
          onClick={onCancelar}
          className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancelar — volver al formulario
        </button>
      </div>
    </div>
  )
}
