import { useState, useMemo } from 'react'
import TablaTareas from '../components/tareas/TablaTareas'
import FormTarea from '../components/tareas/FormTarea'
import FormEditarTarea from '../components/tareas/FormEditarTarea'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import { useTareas } from '../hooks/useTareas'
import { useFuncionarios } from '../hooks/useFuncionarios'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { formatFecha, diasRestantes, diasHabilesRestantes, esHoy, formatDiaCorto, esEstadoFinal } from '../lib/utils'
import { notificarAsignacion } from '../lib/notificaciones'
import { generarBorradorIA } from '../lib/borradorIA'

// Tipos de tarea para los que tiene sentido generar un borrador de
// respuesta con IA — tutela/petición/queja son solicitudes que requieren
// una respuesta formal; reunión/tarea/solicitud genérica/otro no.
const TIPOS_CON_BORRADOR_IA = ['tutela', 'peticion', 'queja']

const ESTADOS         = ['todos', 'pendiente', 'en_proceso', 'resuelto', 'vencido']
// En la vista "Activas" no tiene sentido filtrar por resuelto/vencido — ya están
// excluidas de la lista por la pestaña misma. Dropdown reducido para esa vista.
const ESTADOS_ACTIVAS = ['todos', 'pendiente', 'en_proceso']
const TIPOS           = ['todos', 'tutela', 'peticion', 'queja', 'solicitud', 'tarea', 'reunion', 'otro']
const PRIORIDADES     = ['todos', 'critica', 'alta', 'media', 'baja']
// 'vencimiento' es un filtro derivado (calculado), no una columna — refleja
// exactamente los mismos criterios que los KPI del Dashboard.
const VENCIMIENTOS    = ['todos', 'hoy', 'vencidas']

const ESTADO_LABEL = {
  todos: 'Todos los estados', pendiente: 'Pendiente', en_proceso: 'En proceso',
  resuelto: 'Resuelto', vencido: 'Vencido',
}
const TIPO_LABEL = {
  todos: 'Todos los tipos', tutela: 'Tutela', peticion: 'Petición', queja: 'Queja',
  solicitud: 'Solicitud', tarea: 'Tarea', reunion: 'Reunión', otro: 'Otro',
}
const PRIORIDAD_LABEL = {
  todos: 'Toda prioridad', critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja',
}
const VENCIMIENTO_LABEL = {
  todos: 'Cualquier vencimiento', hoy: 'Vencen hoy', vencidas: 'Vencidas',
}

/**
 * Espejo exacto de los criterios usados para los KPI "Vencen hoy" / "Vencidas"
 * en Dashboard.jsx: solo aplica sobre tareas activas (no en estado final).
 */
function matchesVencimiento(t, filtro) {
  if (filtro === 'todos') return true
  if (esEstadoFinal(t.estado)) return false
  if (filtro === 'hoy') return esHoy(t.fecha_limite)
  if (filtro === 'vencidas') {
    const d = diasHabilesRestantes(t.fecha_limite)
    return d !== null && d < 0
  }
  return true
}

/**
 * @param {{ filtroInicial?: { vista?: string, estado?: string, prioridad?: string, vencimiento?: string } }} props
 *
 * filtroInicial llega desde App.jsx cuando se navega aquí con un filtro
 * pre-aplicado (ej. clic en un KPI del Dashboard). Como Tareas se desmonta
 * y remonta por completo en cada cambio de página (ver PAGE_MAP en App.jsx),
 * basta con usarlo como valor inicial perezoso de useState — no hace falta
 * un useEffect de sincronización.
 */
export default function Tareas({ filtroInicial } = {}) {
  const { tareas, loading, error, crearTarea, actualizarTarea } = useTareas()
  const { funcionarios } = useFuncionarios({ soloActivos: true })
  const { user } = useAuth()
  const { profile } = useUserProfile(user?.id)
  const [busqueda, setBusqueda]             = useState('')
  const [vistaTareas, setVistaTareas]       = useState(() => filtroInicial?.vista ?? 'activas') // 'activas' | 'todas'
  const [filtroEstado, setFiltroEstado]     = useState(() => filtroInicial?.estado ?? 'todos')
  const [filtroTipo, setFiltroTipo]         = useState('todos')
  const [filtroPrioridad, setFiltroPrioridad] = useState(() => filtroInicial?.prioridad ?? 'todos')
  const [filtroVencimiento, setFiltroVencimiento] = useState(() => filtroInicial?.vencimiento ?? 'todos')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(!!filtroInicial)
  const [modalNueva, setModalNueva]         = useState(false)
  const [guardando, setGuardando]           = useState(false)
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null)
  const [errorAccion, setErrorAccion]       = useState(null)
  const [notifDetalle, setNotifDetalle]     = useState({}) // { enviando, correoEnviado, error }
  const [funcEdit, setFuncEdit]             = useState(null)  // id seleccionado en el panel detalle
  const [guardandoFunc, setGuardandoFunc]   = useState(false)
  const [modalEditar, setModalEditar]       = useState(false)
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  // Borrador de respuesta con IA (panel detalle) — solo admin, solo tutela/peticion/queja
  const [borradorTexto, setBorradorTexto]         = useState('')
  const [generandoBorrador, setGenerandoBorrador] = useState(false)
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [errorBorrador, setErrorBorrador]         = useState(null)
  const [copiadoBorrador, setCopiadoBorrador]     = useState(false)

  const hayFiltros = busqueda || filtroEstado !== 'todos' || filtroTipo !== 'todos' ||
    filtroPrioridad !== 'todos' || filtroVencimiento !== 'todos'

  // Tareas "activas" = no están en un estado final (resuelto/archivado).
  // La pestaña "Activas" oculta el historial resuelto por defecto; nunca se borran de la BD.
  const tareasActivas = useMemo(() => tareas.filter(t => !esEstadoFinal(t.estado)), [tareas])

  const tareasFiltradas = useMemo(() => {
    const base = vistaTareas === 'activas' ? tareasActivas : tareas
    return base.filter(t => {
      const matchBusqueda = !busqueda ||
        t.asunto?.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.remitente?.toLowerCase().includes(busqueda.toLowerCase())
      const matchEstado      = filtroEstado === 'todos' || t.estado === filtroEstado
      const matchTipo        = filtroTipo   === 'todos' || t.tipo   === filtroTipo
      const matchPrioridad   = filtroPrioridad === 'todos' || t.prioridad === filtroPrioridad
      const matchVencimiento = matchesVencimiento(t, filtroVencimiento)
      return matchBusqueda && matchEstado && matchTipo && matchPrioridad && matchVencimiento
    })
  }, [tareas, tareasActivas, vistaTareas, busqueda, filtroEstado, filtroTipo, filtroPrioridad, filtroVencimiento])

  function cambiarVista(v) {
    setVistaTareas(v)
    setFiltroEstado('todos') // evita quedar con un estado inválido/confuso al cambiar de pestaña
  }

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

  async function handleGenerarBorrador() {
    if (!sel) return
    setGenerandoBorrador(true)
    setErrorBorrador(null)
    setCopiadoBorrador(false)
    const res = await generarBorradorIA(sel.id)
    setGenerandoBorrador(false)
    if (res.ok) {
      setBorradorTexto(res.borrador)
      setTareaSeleccionada(prev => (prev ? { ...prev, borrador_ia: res.borrador } : prev))
    } else {
      setErrorBorrador(res.error ?? 'Error al generar el borrador')
    }
  }

  async function handleGuardarBorrador() {
    if (!sel) return
    setGuardandoBorrador(true)
    setErrorBorrador(null)
    try {
      const actualizada = await actualizarTarea(sel.id, { borrador_ia: borradorTexto })
      setTareaSeleccionada(actualizada)
    } catch (e) {
      setErrorBorrador('Error al guardar: ' + e.message)
    } finally {
      setGuardandoBorrador(false)
    }
  }

  async function handleCopiarBorrador() {
    try {
      await navigator.clipboard.writeText(borradorTexto)
      setCopiadoBorrador(true)
      setTimeout(() => setCopiadoBorrador(false), 2000)
    } catch {
      setErrorBorrador('No se pudo copiar al portapapeles')
    }
  }

  async function handleGuardarEdicion(cambios) {
    if (!sel) return
    setGuardandoEdicion(true)
    setErrorAccion(null)
    try {
      const actualizada = await actualizarTarea(sel.id, cambios)
      setTareaSeleccionada(actualizada)
      setModalEditar(false)
    } catch (e) {
      setErrorAccion('Error al guardar: ' + e.message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroEstado('todos')
    setFiltroTipo('todos')
    setFiltroPrioridad('todos')
    setFiltroVencimiento('todos')
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
                ? 'border-primary/30 bg-primary-light text-primary'
                : 'border-slate-200 text-slate-600'
              }`}
          >
            <span>⚙</span>
            {hayFiltros && <span className="text-xs font-bold">●</span>}
          </button>
          <button
            onClick={() => { setModalNueva(true); setErrorAccion(null) }}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white
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

      {/* ── Toggle Activas / Todas (historial) ───────────────────────────── */}
      <div className="px-4 sm:px-6 pt-3 flex gap-1 shrink-0 bg-white">
        {[
          { value: 'activas', label: `Activas (${tareasActivas.length})` },
          { value: 'todas',   label: `Todas (${tareas.length})` },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => cambiarVista(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              vistaTareas === value
                ? 'bg-primary text-white border-primary'
                : 'text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
                       text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(vistaTareas === 'activas' ? ESTADOS_ACTIVAS : ESTADOS).map(e => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
            <select
              value={filtroPrioridad}
              onChange={e => setFiltroPrioridad(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PRIORIDADES.map(p => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
            </select>
            <select
              value={filtroVencimiento}
              onChange={e => setFiltroVencimiento(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5
                         text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {VENCIMIENTOS.map(v => <option key={v} value={v}>{VENCIMIENTO_LABEL[v]}</option>)}
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
            setBorradorTexto(t.borrador_ia ?? '')
            setErrorBorrador(null)
            setCopiadoBorrador(false)
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

      {/* ── Modal editar tarea ────────────────────────────────────────── */}
      <Modal
        open={modalEditar && !!sel}
        onClose={() => setModalEditar(false)}
        title={sel ? `Editar — ${sel.asunto}` : 'Editar tarea'}
        width="max-w-2xl"
      >
        {errorAccion && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorAccion}
          </div>
        )}
        <FormEditarTarea
          tarea={sel}
          onSubmit={handleGuardarEdicion}
          onCancel={() => setModalEditar(false)}
          loading={guardandoEdicion}
        />
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setModalEditar(true); setErrorAccion(null) }}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg
                             border border-slate-200 text-slate-600
                             hover:border-primary/40 hover:text-primary hover:bg-primary-light transition-colors"
                  title="Editar todos los campos"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => setTareaSeleccionada(null)}
                  className="text-slate-400 hover:text-slate-600 text-2xl leading-none p-1"
                >
                  ×
                </button>
              </div>
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
                  {esEstadoFinal(sel.estado) ? (
                    <p className="text-xs mt-0.5 text-green-600 font-medium">✓ Resuelto</p>
                  ) : sel.fecha_limite && (() => {
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
                                 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
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
                        className="mt-2 w-full py-1.5 rounded-lg bg-primary text-white text-xs
                                   font-medium hover:bg-primary-hover disabled:opacity-50 transition-colors"
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
                                  ? 'bg-white text-slate-700 border-slate-200 hover:bg-primary-light hover:border-primary/30 hover:text-primary'
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

              {/* Borrador de respuesta con IA — solo admin, solo tutela/petición/queja */}
              {profile?.role === 'admin' && TIPOS_CON_BORRADOR_IA.includes(sel.tipo) && (() => {
                const cambioBorrador = borradorTexto !== (sel.borrador_ia ?? '')
                return (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400 mb-2 font-medium">Borrador de respuesta (IA)</p>

                    {errorBorrador && (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-2">
                        {errorBorrador}
                      </p>
                    )}

                    {generandoBorrador ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Generando borrador con IA…
                      </div>
                    ) : !borradorTexto ? (
                      <button
                        onClick={handleGenerarBorrador}
                        className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium
                                   hover:bg-primary-hover transition-colors"
                      >
                        ✨ Generar borrador con IA
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={borradorTexto}
                          onChange={e => setBorradorTexto(e.target.value)}
                          rows={10}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700
                                     leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                        />

                        {cambioBorrador && (
                          <button
                            onClick={handleGuardarBorrador}
                            disabled={guardandoBorrador}
                            className="w-full py-1.5 rounded-lg bg-primary text-white text-xs font-medium
                                       hover:bg-primary-hover disabled:opacity-50 transition-colors"
                          >
                            {guardandoBorrador ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={handleCopiarBorrador}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                              ${copiadoBorrador
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                          >
                            {copiadoBorrador ? '✓ Copiado' : '📋 Copiar al portapapeles'}
                          </button>
                          <button
                            onClick={handleGenerarBorrador}
                            disabled={generandoBorrador}
                            className="flex-1 py-1.5 rounded-lg text-xs font-medium border border-slate-200
                                       text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            🔄 Regenerar
                          </button>
                        </div>
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
