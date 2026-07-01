import {
  ClipboardList, AlertTriangle, Clock, XCircle, RefreshCw,
} from 'lucide-react'
import StatCard from '../components/dashboard/StatCard'
import TareaUrgente from '../components/dashboard/TareaUrgente'
import EventoHoy from '../components/dashboard/EventoHoy'
import { useTareas } from '../hooks/useTareas'
import { useAgenda } from '../hooks/useAgenda'
import { useGmailSync } from '../hooks/useGmailSync'
import { diasHabilesRestantes, esHoy } from '../lib/utils'

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

export default function Dashboard() {
  const { tareas, loading: loadingTareas, error: errorTareas, refetch: refetchTareas } = useTareas()
  const { eventos, loading: loadingEventos } = useAgenda()
  const { sincronizando, ultimaSync, resultado, gmailConectado, sincronizarAhora } =
    useGmailSync({ habilitado: true })

  const activas    = tareas.filter(t => t.estado !== 'resuelto')
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
              onClick={async () => { await sincronizarAhora(); refetchTareas() }}
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
            {resultado?.creados?.tareas > 0 && (
              <span className="text-xs font-medium text-primary bg-primary-light px-2 py-0.5 rounded-full">
                +{resultado.creados.tareas} tarea{resultado.creados.tareas !== 1 ? 's' : ''} nuevas
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard
          label="Pendientes"
          value={loadingTareas ? '…' : pendientes}
          sub="sin resolver"
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          label="Críticas"
          value={loadingTareas ? '…' : criticas}
          sub="tutelas y urgentes"
          icon={AlertTriangle}
          color={criticas > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Vencen hoy"
          value={loadingTareas ? '…' : vencenHoy}
          sub="atención inmediata"
          icon={Clock}
          color={vencenHoy > 0 ? 'orange' : 'default'}
        />
        <StatCard
          label="Vencidas"
          value={loadingTareas ? '…' : vencidas}
          sub="requieren acción"
          icon={XCircle}
          color={vencidas > 0 ? 'red' : 'default'}
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
    </div>
  )
}
