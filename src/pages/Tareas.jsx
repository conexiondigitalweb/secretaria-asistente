import { useState, useMemo } from 'react'
import TablaTareas from '../components/tareas/TablaTareas'
import FormTarea from '../components/tareas/FormTarea'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { useTareas } from '../hooks/useTareas'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { formatFecha, diasRestantes, diasHabilesRestantes, esHoy, formatDiaCorto } from '../lib/utils'
import { notificarAsignacion } from '../lib/notificaciones'

const ESTADOS = ['todos', 'pendiente', 'en_proceso', 'resuelto', 'vencido']
const TIPOS   = ['todos', 'tutela', 'peticion', 'queja', 'solicitud', 'tarea', 'reunion', 'otro']

const ESTADO_LABEL = {
  todos: 'Todos los estados', pendiente: 'Pendiente', en_proceso: 'En proceso',
  resuelto: 'Resuelto', vencido: 'Vencido',
}
const TIPO_LABEL = {
  todos: 'Todos los tipos', tutela: 'Tutela', peticion: 'Petición', queja: 'Queja',
  solicitud: 'Solicitud', tarea: 'Tarea', reunion: 'Reunión', otro: 'Otro',
}

export default function Tareas() {
  const { tareas, loading, error, crearTarea, actualizarTarea } = useTareas()
  const { funcionarios } = useFuncionarios({ soloActivos: true })
  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('todos')
  const [filtroTipo, setFiltroTipo]         = useState('todos')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [modalNueva, setModalNueva]         = useState(false)
  const [guardando, setGuardando]           = useState(false)
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [errorAccion, setErrorAccion]       = useState(null)
  const [notifDetalle, setNotifDetalle]     = useState({}) // { enviando, correoEnviado, error }
  const [funcEdit, setFuncEdit]             = useState(null)  // id seleccionado en el panel detalle
  const [guardandoFunc, setGuardandoFunc]   = useState(false)

  const hayFiltros = busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos'

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

  async function handleNuevaTarea(data) {
    setGuardando(true)
    setErrorAccion(null)
    try {
      await crearTarea(data)
      setModalNueva(false)
    } catch (e) {
      setErrorAccion('Error al guardar: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  function waLinkDetalle(funcionario, tarea) {
    const wa = funcionario?.whatsapp ?? ''
    const tel = wa.replace(/[\s\-().+]/g, '')
    if (!tel) return null
    const num = tel.startsWith('57') ? tel : '57' + tel
    const fechaStr = tarea.fecha_limite
      ? `Fecha límite: ${new Date(tarea.fecha_limite).toLocaleDateString('es-CO', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })}.`
      : ''
    const msg =
      `Hola ${funcionario.nombre}, se te ha asignado la siguiente tarea en SecretaríaOS:\n\n` +
      `*Asunto:* ${tarea.asunto}\n` +
      `*Tipo:* ${tarea.tipo}\n` +
      (tarea.remitente ? `*Remitente:* ${tarea.remitente}\n` : '') +
      (fechaStr ? `*${fechaStr}*\n` : '') +
      (tarea.descripcion ? `\n${tarea.descripcion}` : '')
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
  }

  async function handleGuardarFuncionario() {
    if (!sel) return
    setGuardandoFunc(true)
    setNotifDetalle({})
    try {
      const actualizada = await actualizarTarea(sel.id, { funcionario_id: funcEdit || null })
      setTareaSeleccionada(actualizada)
    } catch (e) {
      setNotifDetalle({ error: 'Error al guardar: ' + e.message })
    } finally {
      setGuardandoFunc(false)
    }
  }

  async function handleNotificarDetalle() {
    const f = funcionarios.find(fn => fn.id === funcEdit) ?? sel?.funcionario
    if (!f) return
    setNotifDetalle({ enviando: true, error: null })
    const { correo } = await notificarAsignacion(f, sel)
    setNotifDetalle({ enviando: false, correoEnviado: correo.ok, error: correo.ok ? null : correo.error })
  }

  async function handleActualizarEstado(id, estado) {
    setErrorAccion(null)
    try {
      const actualizada = await actualizarTarea(id, { estado })
      setTareaSeleccionada(actualizada)
    } catch (e) {
      setErrorAccion('Error al actualizar: ' + e.message)
    }
  }

  function limpiarFiltros() {
    setBusqueda(''); setFiltroEstado('todos'); setFiltroTipo('todos')
  }

  const sel = tareaSeleccionada

  return (
    <div className="flex flex-col h-full">

      {/* ── Cabecera ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-white
                      flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 truncate">
            Tareas y Solicitudes
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading ? 'Cargando…' : `${tareas.length} registros totales`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Botón filtros — solo en móvil */}
          <button
            onClick={() => setFiltrosAbiertos(v => !v)}
            className={`md:hidden flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
              ${hayFiltros
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600'
              }`}
          >
            <span>⚙</span>
            {hayFiltros && <span className="text-xs font-bold">●</span>}
          </button>
          <button
            onClick={() => { setModalNueva(true); setErrorAccion(null) }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
                       text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Nueva tarea</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>
      </div>

      {/* Error global */}
      {(error || errorAccion) && (
        <div className="mx-4 sm:mx-6 mt-3 text-xs text-red-600 bg-red-50
                        border border-red-200 rounded-lg px-3 py-2 shrink-0">
          {error?.message || errorAccion}
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────── */}
      {/* En desktop: siempre visible en fila. En móvil: colapsable en columna */}
      <div className={`border-b border-slate-200 bg-white shrink-0
                       ${filtrosAbiertos ? 'block' : 'hidden'} md:block`}>
        <div className="px-4 sm:px-6 py-3 flex flex-col md:flex-row md:flex-wrap
                        md:items-center gap-2 md:gap-3">
          <input
            type="search"
            placeholder="Buscar por asunto o remitente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full md:w-64 border border-slate-200 rounded-lg px-3 py-1.5
                       text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
            </select>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between md:contents">
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                className="text-xs text-slate-400 hover:text-slate-600 underline"
              >
                Limpiar filtros
              </button>
            )}
            <span className="text-xs text-slate-400 md:ml-auto">
              {tareasFiltradas.length} resultado{tareasFiltradas.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* ── Tabla con scroll horizontal ───────────────────────────────── */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <TablaTareas tareas={tareasFiltradas} onSelect={t => {
            setTareaSeleccionada(t)
            setFiltrosAbiertos(false)
            setNotifDetalle({})
            setFuncEdit(t.funcionario_id ?? '')
          }} />
        )}
      </div>

      {/* ── Modal nueva tarea ─────────────────────────────────────────── */}
      <Modal open={modalNueva} onClose={() => setModalNueva(false)}
             title="Registrar nueva tarea" width="max-w-2xl">
        <FormTarea onSubmit={handleNuevaTarea}
                   onCancel={() => setModalNueva(false)}
                   loading={guardando} />
      </Modal>

      {/* ── Panel detalle — full screen en móvil, lateral en desktop ──── */}
      {sel && (
        <>
          {/* Backdrop en móvil */}
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40"
            onClick={() => setTareaSeleccionada(null)}
          />
          <div className="fixed inset-x-0 bottom-0 top-16 md:top-0 md:inset-y-0
                          md:left-auto md:right-0 md:w-96
                          bg-white border-t md:border-t-0 md:border-l border-slate-200
                          shadow-xl z-50 flex flex-col rounded-t-2xl md:rounded-none">

            <div className="flex items-center justify-between px-5 py-4
                            border-b border-slate-200 shrink-0">
              <h2 className="text-sm font-semibold text-slate-800">Detalle de tarea</h2>
              <button
                onClick={() => setTareaSeleccionada(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4
                            pb-safe-area-inset-bottom">
              <div className="flex gap-2 flex-wrap">
                <Badge value={sel.tipo} />
                <Badge value={sel.prioridad} />
                <Badge value={sel.estado} />
              </div>

              {sel.radicado && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Radicado</p>
                  <p className="text-xs font-mono text-slate-700 bg-slate-100
                                rounded px-2 py-1 break-all">{sel.radicado}</p>
                </div>
              )}

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
                    const d = diasHabilesRestantes(sel.fecha_limite)
                    if (d === null) return null
                    const hoyExacto = esHoy(sel.fecha_limite)
                    const color = d < 0 || hoyExacto
                      ? 'text-red-600'
                      : d === 0 ? 'text-orange-500'
                      : d <= 3   ? 'text-orange-500'
                      : 'text-slate-400'
                    const label = d < 0
                      ? `Venció hace ${Math.abs(d)} días hábiles`
                      : hoyExacto
                        ? 'Vence hoy'
                        : d === 0
                          ? `0 días hábiles — Vence ${formatDiaCorto(sel.fecha_limite)}`
                          : `${d} días hábiles`
                    return <p className={`text-xs mt-0.5 ${color}`}>{label}</p>
                  })()}
                </div>
              </div>

              {sel.origen && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Origen</p>
                  <Badge value={sel.origen} />
                </div>
              )}

              {/* Funcionario asignado — editable */}
              {(() => {
                const funcActual = sel.funcionario
                const funcSeleccionado = funcionarios.find(f => f.id === funcEdit) ?? null
                const cambio = funcEdit !== (sel.funcionario_id ?? '')
                const waLink = funcSeleccionado ? waLinkDetalle(funcSeleccionado, sel) : null

                return (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400 mb-2 font-medium">Funcionario asignado</p>

                    {/* Selector */}
                    <select
                      value={funcEdit ?? ''}
                      onChange={e => { setFuncEdit(e.target.value); setNotifDetalle({}) }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
                                 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Sin asignar —</option>
                      {funcionarios.map(f => (
                        <option key={f.id} value={f.id}>{f.nombre} · {f.cargo}</option>
                      ))}
                    </select>

                    {/* Botón guardar — aparece solo si hay cambio */}
                    {cambio && (
                      <button
                        onClick={handleGuardarFuncionario}
                        disabled={guardandoFunc}
                        className="mt-2 w-full py-1.5 rounded-lg bg-blue-600 text-white text-xs
                                   font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {guardandoFunc ? 'Guardando…' : funcEdit ? 'Guardar asignación' : 'Quitar funcionario'}
                      </button>
                    )}

                    {/* Botones de notificación — aparecen cuando hay funcionario seleccionado */}
                    {funcSeleccionado && !cambio && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs text-slate-500 mb-2">
                          Notificar a <span className="font-medium text-slate-700">{funcSeleccionado.nombre}</span>
                        </p>
                        <div className="flex gap-2">
                          {/* Correo */}
                          <button
                            onClick={handleNotificarDetalle}
                            disabled={!funcSeleccionado.correo || notifDetalle.enviando}
                            title={funcSeleccionado.correo ?? 'Sin correo registrado'}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                              text-xs font-medium border transition-colors
                              ${notifDetalle.correoEnviado
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : funcSeleccionado.correo
                                  ? 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                          >
                            {notifDetalle.enviando ? '⏳' : notifDetalle.correoEnviado ? '✓' : '✉️'}
                            {notifDetalle.correoEnviado ? 'Enviado' : 'Correo'}
                          </button>
                          {/* WhatsApp */}
                          <a
                            href={waLink ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => !waLink && e.preventDefault()}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg
                              text-xs font-medium border transition-colors no-underline
                              ${waLink
                                ? 'bg-white text-slate-700 border-slate-200 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                        {notifDetalle.error && (
                          <p className="text-xs text-red-600 mt-2">{notifDetalle.error}</p>
                        )}
                        {!funcSeleccionado.correo && !funcSeleccionado.whatsapp && (
                          <p className="text-xs text-slate-400 mt-2">
                            Sin correo ni WhatsApp — regístralos en Configuración.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-400 mb-2 font-medium">Cambiar estado</p>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 'pendiente',  label: 'Pendiente' },
                    { value: 'en_proceso', label: 'En proceso' },
                    { value: 'resuelto',   label: '✓ Marcar Resuelto' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => handleActualizarEstado(sel.id, value)}
                      disabled={sel.estado === value}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors border
                        ${sel.estado === value
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
