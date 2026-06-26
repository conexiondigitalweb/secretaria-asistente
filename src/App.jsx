import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tareas from './pages/Tareas'
import Agenda from './pages/Agenda'
import Documentos from './pages/Documentos'
import Configuracion from './pages/Configuracion'

const PAGES = [
  { id: 'dashboard',     label: 'Dashboard',    icon: '🏠' },
  { id: 'tareas',        label: 'Tareas',        icon: '📋' },
  { id: 'agenda',        label: 'Agenda',        icon: '📅' },
  { id: 'documentos',    label: 'Documentos',    icon: '📄' },
  { id: 'configuracion', label: 'Config',        icon: '⚙️' },
]

const PAGE_MAP = {
  dashboard:     Dashboard,
  tareas:        Tareas,
  agenda:        Agenda,
  documentos:    Documentos,
  configuracion: Configuracion,
}

export default function App() {
  const { user, loading, signOut } = useAuth()
  const [page, setPage] = useState('dashboard')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">🏛️</div>
          <p className="text-sm text-slate-400">Cargando SecretaríaOS…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  const PageComponent = PAGE_MAP[page]

  return (
    <div className="flex flex-col h-screen bg-slate-50 md:flex-row">

      {/* ── Sidebar — visible solo en md y up ─────────────────────────── */}
      <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 flex-col shrink-0">
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SecretaríaOS</p>
          <p className="text-sm text-slate-600 mt-0.5">Secretaría de Educación</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {PAGES.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                page === id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-200">
          <p className="text-xs text-slate-500 truncate">{user.email}</p>
          <button
            onClick={signOut}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors mt-1"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <PageComponent />
      </main>

      {/* ── Bottom navigation — visible solo en móvil (< md) ──────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30
                      flex items-stretch h-16 safe-area-inset-bottom">
        {PAGES.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-center
                        transition-colors pt-1
                        ${page === id
                          ? 'text-blue-600'
                          : 'text-slate-400 active:text-slate-600'
                        }`}
          >
            <span className="text-xl leading-none">{icon}</span>
            <span className={`text-[10px] leading-tight ${page === id ? 'font-semibold' : ''}`}>
              {label}
            </span>
            {/* Indicador activo */}
            {page === id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
            )}
          </button>
        ))}
      </nav>

    </div>
  )
}
