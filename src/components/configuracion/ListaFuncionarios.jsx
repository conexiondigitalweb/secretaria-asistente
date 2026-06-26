const TIPO_LABEL = { planta: 'Planta', contratista: 'Contratista' }

const TIPO_BADGE = {
  planta:      'bg-blue-50 text-blue-700 border-blue-200',
  contratista: 'bg-purple-50 text-purple-700 border-purple-200',
}

/**
 * @param {{
 *   funcionarios: object[],
 *   onEditar: (f: object) => void,
 *   onToggleActivo: (id: string, activo: boolean) => void,
 * }} props
 */
export default function ListaFuncionarios({ funcionarios, onEditar, onToggleActivo }) {
  if (funcionarios.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-4xl mb-3">👤</p>
        <p className="text-sm">No hay funcionarios registrados aún</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-slate-100">
      {funcionarios.map(f => (
        <div key={f.id}
          className={`flex items-center gap-3 py-3 px-1 transition-colors
            ${f.activo ? '' : 'opacity-50'}`}>

          {/* Avatar inicial */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center
                           text-sm font-bold shrink-0
                           ${f.activo ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
            {f.nombre.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-800 truncate">{f.nombre}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium
                               ${TIPO_BADGE[f.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {TIPO_LABEL[f.tipo] ?? f.tipo}
              </span>
              {!f.activo && (
                <span className="text-xs px-1.5 py-0.5 rounded-full border
                                 bg-slate-100 text-slate-500 border-slate-200">
                  Inactivo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">{f.cargo}</p>
            {(f.correo || f.telefono) && (
              <p className="text-xs text-slate-400 truncate">
                {[f.correo, f.telefono].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEditar(f)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              ✏️
            </button>
            <button
              onClick={() => onToggleActivo(f.id, !f.activo)}
              className={`p-1.5 rounded-lg transition-colors text-xs font-medium
                ${f.activo
                  ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  : 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                }`}
              title={f.activo ? 'Desactivar' : 'Activar'}
            >
              {f.activo ? '⏸' : '▶'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
