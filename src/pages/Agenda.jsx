import { useState } from 'react'
import { useAgenda } from '../hooks/useAgenda'
import FormEvento from '../components/agenda/FormEvento'
import Modal from '../components/ui/Modal'

const TIPO_BADGE = {
  reunion:      'bg-primary-light text-primary border-primary/20',
  compromiso:   'bg-purple-50 text-purple-700 border-purple-200',
  recordatorio: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  evento:       'bg-green-50 text-green-700 border-green-200',
}
const TIPO_LABEL = {
  reunion: 'Reunión', compromiso: 'Compromiso', recordatorio: 'Recordatorio', evento: 'Evento',
}
const TIPO_ICON = {
  reunion: '🤝', compromiso: '📌', recordatorio: '🔔', evento: '📅',
}

function formatFechaCorta(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function esMismo(a, b) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function agruparPorDia(eventos) {
  const grupos = {}
  for (const e of eventos) {
    const key = new Date(e.fecha_inicio).toDateString()
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(e)
  }
  return Object.entries(grupos).map(([key, evs]) => ({ key, fecha: new Date(evs[0].fecha_inicio), evs }))
}

function EventoCard({ evento, onEditar, onEliminar }) {
  const hoy = new Date().toDateString()
  const esHoy = new Date(evento.fecha_inicio).toDateString() === hoy
  return (
    <div className={`flex gap-3 p-3 rounded-xl border transition-shadow hover:shadow-sm
      ${esHoy ? 'border-primary/20 bg-primary-light/30' : 'border-slate-100 bg-white'}`}>

      {/* Icon */}
      <div className="text-xl shrink-0 mt-0.5">{TIPO_ICON[evento.tipo] ?? '📅'}</div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-slate-800 leading-snug">{evento.titulo}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium shrink-0
            ${TIPO_BADGE[evento.tipo] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {TIPO_LABEL[evento.tipo] ?? evento.tipo}
          </span>
        </div>

        <p className="text-xs text-slate-500 mt-0.5">
          {formatHora(evento.fecha_inicio)}
          {evento.fecha_fin && !esMismo(evento.fecha_inicio, evento.fecha_fin)
            ? ` → ${formatFechaCorta(evento.fecha_fin)} ${formatHora(evento.fecha_fin)}`
            : evento.fecha_fin
              ? ` → ${formatHora(evento.fecha_fin)}`
              : ''}
          {evento.lugar && ` · 📍 ${evento.lugar}`}
        </p>

        {evento.delegado && (
          <p className="text-xs text-slate-400 mt-0.5">
            👤 {evento.delegado.nombre} — {evento.delegado.cargo}
          </p>
        )}
        {evento.descripcion && (
          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{evento.descripcion}</p>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={() => onEditar(evento)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-light transition-colors"
          title="Editar">✏️</button>
        <button onClick={() => onEliminar(evento)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Eliminar">🗑️</button>
      </div>
    </div>
  )
}

export default function Agenda() {
  const { eventos, loading, error, crearEvento, actualizarEvento, eliminarEvento } = useAgenda()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [guardando, setGuardando]       = useState(false)
  const [errorMsg, setErrorMsg]         = useState(null)
  const [filtro, setFiltro]             = useState('proximos') // 'proximos' | 'pasados' | 'todos'
  const [confirmarEliminar, setConfirmarEliminar] = useState(null)

  const ahora = new Date()

  const eventosFiltrados = eventos.filter(e => {
    const inicio = new Date(e.fecha_inicio)
    if (filtro === 'proximos') return inicio >= new Date(ahora.toDateString())
    if (filtro === 'pasados')  return inicio < new Date(ahora.toDateString())
    return true
  })

  const grupos = agruparPorDia(eventosFiltrados)

  function abrirCrear() {
    setEditando(null)
    setErrorMsg(null)
    setModalAbierto(true)
  }
  function abrirEditar(e) {
    setEditando(e)
    setErrorMsg(null)
    setModalAbierto(true)
  }
  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
  }

  async function handleGuardar(datos) {
    setGuardando(true)
    setErrorMsg(null)
    try {
      if (editando) {
        await actualizarEvento(editando.id, datos)
      } else {
        await crearEvento(datos)
      }
      cerrarModal()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar() {
    if (!confirmarEliminar) return
    try {
      await eliminarEvento(confirmarEliminar.id)
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setConfirmarEliminar(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Agenda</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {loading ? '…' : `${eventos.length} evento${eventos.length !== 1 ? 's' : ''} registrados`}
          </p>
        </div>
        <button onClick={abrirCrear}
          className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white
                     text-sm font-medium px-3 py-2 rounded-lg transition-colors">
          <span className="text-base leading-none">+</span>
          <span className="hidden sm:inline">Nuevo evento</span>
          <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-4">
        {[
          { value: 'proximos', label: 'Próximos' },
          { value: 'pasados',  label: 'Pasados' },
          { value: 'todos',    label: 'Todos' },
        ].map(({ value, label }) => (
          <button key={value} onClick={() => setFiltro(value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filtro === value ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Error global */}
      {(error || errorMsg) && (
        <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error?.message ?? errorMsg}
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-5xl mb-3">📅</p>
          <p className="text-sm font-medium text-slate-500">No hay eventos {filtro === 'proximos' ? 'próximos' : filtro === 'pasados' ? 'pasados' : ''}</p>
          <p className="text-xs mt-1">Crea el primer evento con el botón "Nuevo"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ key, fecha, evs }) => {
            const esHoy = fecha.toDateString() === ahora.toDateString()
            const esMañana = fecha.toDateString() === new Date(ahora.getTime() + 86400000).toDateString()
            const labelDia = esHoy ? 'Hoy' : esMañana ? 'Mañana'
              : fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

            return (
              <div key={key}>
                <div className={`flex items-center gap-2 mb-2 ${esHoy ? 'text-primary' : 'text-slate-500'}`}>
                  <span className={`text-xs font-semibold uppercase tracking-wide ${esHoy ? 'text-primary' : ''}`}>
                    {labelDia}
                  </span>
                  {esHoy && (
                    <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded-full font-medium">HOY</span>
                  )}
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{evs.length} evento{evs.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2">
                  {evs.map(e => (
                    <EventoCard key={e.id} evento={e}
                      onEditar={abrirEditar}
                      onEliminar={setConfirmarEliminar} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal
        open={modalAbierto}
        onClose={cerrarModal}
        title={editando ? `Editar — ${editando.titulo}` : 'Nuevo evento'}
      >
        {errorMsg && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}
        <FormEvento
          inicial={editando}
          onSubmit={handleGuardar}
          onCancel={cerrarModal}
          loading={guardando}
        />
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal
        open={!!confirmarEliminar}
        onClose={() => setConfirmarEliminar(null)}
        title="Eliminar evento"
      >
        <p className="text-sm text-slate-700 mb-1">
          ¿Eliminar <strong>{confirmarEliminar?.titulo}</strong>?
        </p>
        <p className="text-xs text-slate-400 mb-5">Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <button onClick={() => setConfirmarEliminar(null)}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleEliminar}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors">
            Eliminar
          </button>
        </div>
      </Modal>

    </div>
  )
}
