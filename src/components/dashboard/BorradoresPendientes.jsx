/**
 * BorradoresPendientes — sección del Dashboard con correos clasificados
 * que esperan aprobación manual del secretario.
 *
 * Se muestra solo si hay ≥ 1 borrador pendiente.
 */

import { Mail } from 'lucide-react'
import BorradorCard from './BorradorCard'

export default function BorradoresPendientes({
  borradores,
  loading,
  procesando,
  onAprobar,
  onRechazar,
}) {
  if (!loading && borradores.length === 0) return null

  return (
    <div className="bg-surface rounded-xl border border-orange-200 shadow-sm overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-orange-600" />
          <h2 className="text-sm font-semibold text-orange-800">
            Correos pendientes de revisión
          </h2>
        </div>
        {borradores.length > 0 && (
          <span className="text-xs font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">
            {borradores.length}
          </span>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-28 bg-surface-3 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {borradores.map(b => (
              <BorradorCard
                key={b.id}
                borrador={b}
                onAprobar={onAprobar}
                onRechazar={onRechazar}
                procesando={procesando === b.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
