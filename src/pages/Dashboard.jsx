import StatCard from '../components/dashboard/StatCard'
import TareaUrgente from '../components/dashboard/TareaUrgente'
import EventoHoy from '../components/dashboard/EventoHoy'
import { useTareas } from '../hooks/useTareas'
import { useAgenda } from '../hooks/useAgenda'
import { diasRestantes } from '../lib/utils'

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
  const { tareas, loading: loadingTareas, error: errorTareas } = useTareas()
  const { eventos, loading: loadingEventos } = useAgenda()

  // KPIs — excluir resueltos
  const activas    = tareas.filter(t => t.estado !== 'resuelto')
  const pendientes = activas.length
  const criticas   = activas.filter(t => t.prioridad === 'critica').length
  const vencenHoy  = activas.filter(t => diasRestantes(t.fecha_limite) === 0).length
  const vencidas   = activas.filter(t => {
    const d = diasRestantes(t.fecha_limite)
    return d !== null && d < 0
  }).length

  // Top 5 más urgentes por fecha límite
  const urgentes = [...activas]
    .filter(t => t.fecha_limite)
    .sort((a, b) => diasRestantes(a.fecha_limite) - diasRestantes(b.fecha_limite))
    .slice(0, 5)

  // Eventos de hoy y mañana
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 2)
  const proximosEventos = [...eventos]
    .filter(e => {
      const f = new Date(e.fecha_inicio)
      return f >= hoy && f < manana
    })
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">
          {saludo()}, Secretario Sanjuán
        </h1>
        <p className="text-sm text-slate-500 mt-0.5 capitalize">{fechaLarga()}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Pendientes"
          value={loadingTareas ? '…' : pendientes}
          sub="sin resolver"
          color="default"
        />
        <StatCard
          label="Tutelas / Críticas"
          value={loadingTareas ? '…' : criticas}
          sub="prioridad máxima"
          color={criticas > 0 ? 'red' : 'default'}
        />
        <StatCard
          label="Vencen hoy"
          value={loadingTareas ? '…' : vencenHoy}
          sub="atención inmediata"
          color={vencenHoy > 0 ? 'yellow' : 'default'}
        />
        <StatCard
          label="Vencidas"
          value={loadingTareas ? '…' : vencidas}
          sub="requieren acción"
          color={vencidas > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Cuerpo principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tareas urgentes — 2/3 del ancho */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Próximas a vencer</h2>
            <span className="text-xs text-slate-400">{urgentes.length} tareas</span>
          </div>
          {loadingTareas ? (
            <div className="space-y-3 py-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : urgentes.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Sin tareas urgentes 🎉</p>
          ) : (
            urgentes.map(t => <TareaUrgente key={t.id} tarea={t} />)
          )}
        </div>

        {/* Agenda hoy */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Agenda de hoy</h2>
            <span className="text-xs text-slate-400">{proximosEventos.length} eventos</span>
          </div>
          {loadingEventos ? (
            <div className="space-y-3 py-2">
              {[1,2].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : proximosEventos.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">Día sin eventos</p>
          ) : (
            proximosEventos.map(e => <EventoHoy key={e.id} evento={e} />)
          )}
        </div>
      </div>
    </div>
  )
}
