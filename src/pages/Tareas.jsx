import { useState, useMemo } from 'react'
import TablaTareas from '../components/tareas/TablaTareas'
import FormTarea from '../components/tareas/FormTarea'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { MOCK_TAREAS } from '../components/dashboard/mockData'
import { formatFecha, diasRestantes } from '../lib/utils'

const ESTADOS  = ['todos', 'pendiente', 'en_proceso', 'resuelto', 'vencido']
const TIPOS    = ['todos', 'tutela', 'peticion', 'queja', 'solicitud', 'tarea', 'reunion', 'otro']

const ESTADO_LABEL = {
  todos: 'Todos los estados', pendiente: 'Pendiente', en_proceso: 'En proceso',
  resuelto: 'Resuelto', vencido: 'Vencido',
}
const TIPO_LABEL = {
  todos: 'Todos los tipos', tutela: 'Tutela', peticion: 'Petición', queja: 'Queja',
  solicitud: 'Solicitud', tarea: 'Tarea', reunion: 'Reunión', otro: 'Otro',
}

export default function Tareas() {
  const [tareas, setTareas]       = useState(MOCK_TAREAS)
  const [busqueda, setBusqueda]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo]     = useState('todos')
  const [modalNueva, setModalNueva]     = useState(false)
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)

  const tareasFiltradas = useMemo(() => {
    return tareas.filter(t => {
      const matchBusqueda = !busqueda ||
        t.asunto?.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.remitente?.toLowerCase().includes(busqueda.toLowerCase())
      const matchEstado = filtroEstado === 'todos' || t.estado === filtroEstado
      const matchTipo   = filtroTipo   === 'todos' || t.tipo   === filtroTipo
      return matchBusqueda && matchEstado && matchTipo
    })
  }, [tareas, busqueda, filtroEstado, filtroTipo])

  function handleNuevaTarea(data) {
    const nueva = { ...data, id: crypto.randomUUID() }
    setTareas(prev => [nueva, ...prev])
    setModalNueva(false)
  }

  function handleActualizarEstado(id, estado) {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
    setTareaSeleccionada(prev => prev?.id === id ? { ...prev, estado } : prev)
  }

  const sel = tareaSeleccionada

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Tareas y Solicitudes</h1>
          <p className="text-xs text-slate-400 mt-0.5">{tareas.length} registros totales</p>
        </div>
        <button
          onClick={() => setModalNueva(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Nueva tarea
        </button>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por asunto o remitente…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
        />
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </select>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
        </select>
        {(busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos') && (
          <button
            onClick={() => { setBusqueda(''); setFiltroEstado('todos'); setFiltroTipo('todos') }}
            className="text-xs text-slate-400 hover:text-slate-600 underline"
          >
            Limpiar filtros
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">{tareasFiltradas.length} resultado{tareasFiltradas.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto bg-white px-2">
        <TablaTareas tareas={tareasFiltradas} onSelect={setTareaSeleccionada} />
      </div>

      {/* Modal nueva tarea */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)} title="Registrar nueva tarea" width="max-w-2xl">
        <FormTarea onSubmit={handleNuevaTarea} onCancel={() => setModalNueva(false)} />
      </Modal>

      {/* Panel detalle tarea seleccionada */}
      {sel && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-xl z-40 flex flex-col overflow-y-auto">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-800">Detalle de tarea</h2>
            <button onClick={() => setTareaSeleccionada(null)} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex gap-2 flex-wrap">
              <Badge value={sel.tipo} />
              <Badge value={sel.prioridad} />
              <Badge value={sel.estado} />
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Asunto</p>
              <p className="text-sm font-medium text-slate-800">{sel.asunto}</p>
            </div>
            {sel.remitente && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Remitente</p>
                <p className="text-sm text-slate-700">{sel.remitente}</p>
              </div>
            )}
            {sel.descripcion && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Descripción</p>
                <p className="text-sm text-slate-600 leading-relaxed">{sel.descripcion}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Recibido</p>
                <p className="text-sm text-slate-700">{formatFecha(sel.fecha_recibido)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Fecha límite</p>
                <p className="text-sm text-slate-700">{formatFecha(sel.fecha_limite)}</p>
                {sel.fecha_limite && (() => {
                  const d = diasRestantes(sel.fecha_limite)
                  if (d === null) return null
                  const color = d < 0 ? 'text-red-600' : d <= 3 ? 'text-orange-500' : 'text-slate-400'
                  const label = d < 0 ? `Venció hace ${Math.abs(d)} días` : d === 0 ? 'Vence hoy' : `${d} días restantes`
                  return <p className={`text-xs mt-0.5 ${color}`}>{label}</p>
                })()}
              </div>
            </div>

            {/* Cambio de estado */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400 mb-2">Cambiar estado</p>
              <div className="flex flex-col gap-2">
                {['pendiente', 'en_proceso', 'resuelto'].map(estado => (
                  <button
                    key={estado}
                    onClick={() => handleActualizarEstado(sel.id, estado)}
                    disabled={sel.estado === estado}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors border ${
                      sel.estado === estado
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {estado === 'pendiente' ? 'Marcar Pendiente' : estado === 'en_proceso' ? 'Marcar En proceso' : '✓ Marcar Resuelto'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
