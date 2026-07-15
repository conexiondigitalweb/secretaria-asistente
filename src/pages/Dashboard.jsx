import { useState } from 'react'
import {
  ClipboardList, AlertTriangle, Clock, XCircle, RefreshCw,
} from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'
import TareaUrgente from '../components/dashboard/TareaUrgente'
import EventoHoy from '../components/dashboard/EventoHoy'
import BorradoresPendientes from '../components/dashboard/BorradoresPendientes'
import Modal from '../components/ui/Modal'
import FormEvento from '../components/agenda/FormEvento'
import { useTareas } from '../hooks/useTareas'
import { useAgenda } from '../hooks/useAgenda'
import { useGmailSync } from '../hooks/useGmailSync'
import { useBorradores } from '../hooks/useBorradores'
import { diasHabilesRestantes, esHoy, esEstadoFinal } from '../lib/utils'

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaLarga() {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date())
}

export default function Dashboard({ onNavegarTareas }) {
  const { tareas, loading: loadingTareas, error: errorTareas, refetch: refetchTareas } = useTareas()
  const { eventos, loading: loadingEventos, refetch: refetchEventos, actualizarEvento } = useAgenda()
  const { sincronizando, ultimaSync, resultado, gmailConectado, sincronizarAhora } =
    useGmailSync({ habilitado: true })
  const {
    borradores, loading: loadingBorradores, procesando,
    aprobar, aprobarConEvento, rechazar, fetchBorradores,
  } = useBorradores()

  // Modal de FormEvento para convocatorias sin fecha extraída
  // { borrador, datosPrellenos }
  const [modalEvento, setModalEvento]       = useState(null)
  const [guardandoEvento, setGuardandoEvento] = useState(false)
  const [errorEvento, setErrorEvento]       = useState(null)
  const [calendarSyncMsg, setCalendarSyncMsg] = useState(null)

  // No cuentan como pendientes/vencidas las tareas en estado final (resuelto o archivado).
  const activas    = tareas.filter(t => !esEstadoFinal(t.estado))
  const pendientes = activas.length
  const criticas   = activas.filter(t => t.prioridad === 'critica').length
  const vencenHoy  = activas.filter(t => esHoy(t.fecha_limite)).length
  const vencidas   = activas.filter(t => {
    const d = diasHabilesRestantes(t.fecha_limite)
    return d !== null && d < 0
  }).length

  const urgentes = [...activas]
    .filter(t => t.fecha_limite)
    .sort((a, b) => diasHabilesRestantes(a.fecha_limite) - diasHabilesRestantes(b.fecha_limite))
    .slice(0, 5)

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)
  const proximosEventos = [...eventos]
    .filter(e => { const f = new Date(e.fecha_inicio); return f >= hoy && f < manana })
    .sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))

  if (errorTareas) {
    return (
      <div className="p-6 text-center text-red-500">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm">Error al cargar datos: {errorTareas.message}</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">

      {/* ── Encabezado ────────────────────────────────────────────────── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              {saludo()},&nbsp;
              <span className="text-primary">Secretario Sanjuán</span>
            </h1>
            <p className="text-sm text-text-muted mt-1 capitalize">{fechaLarga()}</p>
          </div>
          {/* Escudo institucional pequeño */}
          <img
            src="/logo-secretaria.jpg"
            alt=""
            className="hidden sm:block h-14 w-14 object-contain opacity-90"
          />
        </div>

        {/* Línea separadora sutil */}
        <div className="mt-4 h-px bg-border" />

        {/* Indicador sync Gmail */}
        {gmailConectado && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={async () => { await sincronizarAhora(); refetchTareas(); fetchBorradores() }}
              disabled={sincronizando}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-primary
                         transition-colors disabled:opacity-50"
              title="Sincronizar Gmail ahora"
            >
              <RefreshCw className={`h-3 w-3 ${sincronizando ? 'animate-spin text-primary' : ''}`} />
              {sincronizando ? 'Sincronizando Gmail…' : 'Gmail conectado'}
            </button>
            {ultimaSync && (
              <span className="text-xs text-text-muted">
                · Última sync {ultimaSync.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {resultado?.borradoresCreados > 0 && (
              <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                +{resultado.borradoresCreados} borrador{resultado.borradoresCreados !== 1 ? 'es' : ''} para revisar
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Aviso de fallo de sincronización con Google Calendar (best-effort) ── */}
      {calendarSyncMsg && (
        <div className="mb-4 flex items-start justify-between gap-3 text-xs text-orange-800
                        bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <span>{calendarSyncMsg}</span>
          <button
            onClick={() => setCalendarSyncMsg(null)}
            className="shrink-0 text-orange-600 hover:text-orange-800 font-medium"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ── Borradores pendientes de aprobación ───────────────────────── */}
      <BorradoresPendientes
        borradores={borradores}
        loading={loadingBorradores}
        procesando={procesando}
        onAprobar={async (b, claseOverride) => {
          const res = await aprobar(b, claseOverride)
          if (res.ok) {
            refetchTareas()
            if (res.tipo === 'evento') {
              refetchEventos()
              // La sincronización con Calendar ya ocurrió dentro de aprobar();
              // acá solo mostramos feedback si falló (best-effort, no bloquea).
              if (res.calendarSync && !res.calendarSync.ok) {
                setCalendarSyncMsg(
                  `El evento se guardó, pero no se pudo sincronizar con Google Calendar (${res.calendarSync.error ?? 'error desconocido'}). Puedes reintentar desde el botón de sincronización en Agenda.`
                )
              }
            }
          } else if (res.needsFormEvento) {
            // Convocatoria sin fecha → abrir FormEvento con datos precargados
            setErrorEvento(null)
            setModalEvento({ borrador: b, datosPrellenos: res.datosPrellenos })
          }
        }}
        onRechazar={rechazar}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          label="Pendientes"
          value={loadingTareas ? '…' : pendientes}
          sub="sin resolver"
          icon={ClipboardList}
          color="blue"
          onClick={onNavegarTareas ? () => onNavegarTareas({ vista: 'activas' }) : undefined}
        />
        <StatCard
          label="Críticas"
          value={loadingTareas ? '…' : criticas}
          sub="tutelas y urgentes"
          icon={AlertTriangle}
          color={criticas > 0 ? 'red' : 'default'}
          onClick={onNavegarTareas ? () => onNavegarTareas({ vista: 'activas', prioridad: 'critica' }) : undefined}
        />
        <StatCard
          label="Vencen hoy"
          value={loadingTareas ? '…' : vencenHoy}
          sub="atención inmediata"
          icon={Clock}
          color={vencenHoy > 0 ? 'orange' : 'default'}
          onClick={onNavegarTareas ? () => onNavegarTareas({ vista: 'activas', vencimiento: 'hoy' }) : undefined}
        />
        <StatCard
          label="Vencidas"
          value={loadingTareas ? '…' : vencidas}
          sub="requieren acción"
          icon={XCircle}
          color={vencidas > 0 ? 'red' : 'default'}
          onClick={onNavegarTareas ? () => onNavegarTareas({ vista: 'activas', vencimiento: 'vencidas' }) : undefined}
        />
      </div>

      {/* ── Cuerpo ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Tareas urgentes */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Próximas a vencer</h2>
            <span className="text-xs text-text-muted px-2 py-0.5 bg-surface-3 rounded-full">
              {urgentes.length} tareas
            </span>
          </div>
          {loadingTareas ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-surface-3 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : urgentes.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm text-text-muted">Sin tareas urgentes</p>
            </div>
          ) : (
            urgentes.map(t => <TareaUrgente key={t.id} tarea={t} />)
          )}
        </div>

        {/* Agenda hoy */}
        <div className="bg-surface rounded-xl border border-border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Agenda de hoy</h2>
            <span className="text-xs text-text-muted px-2 py-0.5 bg-surface-3 rounded-full">
              {proximosEventos.length} eventos
            </span>
          </div>
          {loadingEventos ? (
            <div className="space-y-3 py-2">
              {[1, 2].map(i => (
                <div key={i} className="h-12 bg-surface-3 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : proximosEventos.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-2xl mb-2">📅</p>
              <p className="text-sm text-text-muted">Día sin eventos</p>
            </div>
          ) : (
            proximosEventos.map(e => <EventoHoy key={e.id} evento={e} />)
          )}
        </div>

      </div>

      {/* ── Modal FormEvento para convocatorias sin fecha ─────────────── */}
      <Modal
        open={!!modalEvento}
        onClose={() => { setModalEvento(null); setErrorEvento(null) }}
        title="Crear evento desde correo"
      >
        {modalEvento && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              El correo no incluía fecha. Completá los datos del evento para aprobarlo.
            </p>
            {errorEvento && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorEvento}
              </p>
            )}
            <FormEvento
              inicial={modalEvento.datosPrellenos}
              fechaVacia
              loading={guardandoEvento}
              onCancel={() => { setModalEvento(null); setErrorEvento(null) }}
              onSubmit={async (datosEvento) => {
                setGuardandoEvento(true)
                setErrorEvento(null)
                const res = await aprobarConEvento(modalEvento.borrador, datosEvento)
                setGuardandoEvento(false)
                if (res.ok) {
                  setModalEvento(null)
                  refetchEventos()
                  // La sincronización con Calendar ya ocurrió dentro de aprobarConEvento();
                  // acá solo mostramos feedback si falló (best-effort, no bloquea).
                  if (res.calendarSync && !res.calendarSync.ok) {
                    setCalendarSyncMsg(
                      `El evento se guardó, pero no se pudo sincronizar con Google Calendar (${res.calendarSync.error ?? 'error desconocido'}). Puedes reintentar desde el botón de sincronización en Agenda.`
                    )
                  }
                } else {
                  setErrorEvento(res.error ?? 'Error al crear el evento')
                }
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
