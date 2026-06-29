import { useState } from 'react'
import {
  LayoutDashboard, ClipboardList, Calendar,
  FileText, Settings, LogOut,
} from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tareas from './pages/Tareas'
import Agenda from './pages/Agenda'
import Documentos from './pages/Documentos'
import Configuracion from './pages/Configuracion'
import { cn } from './lib/cn'

const PAGES = [
  { id: 'dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'tareas',        label: 'Tareas',          icon: ClipboardList   },
  { id: 'agenda',        label: 'Agenda',          icon: Calendar        },
  { id: 'documentos',    label: 'Documentos',      icon: FileText        },
  { id: 'configuracion', label: 'Configuración',   icon: Settings        },
]

const BOTTOM_PAGES = [
  { id: 'dashboard',     label: 'Inicio',    icon: LayoutDashboard },
  { id: 'tareas',        label: 'Tareas',    icon: ClipboardList   },
  { id: 'agenda',        label: 'Agenda',    icon: Calendar        },
  { id: 'documentos',    label: 'Docs',      icon: FileText        },
  { id: 'configuracion', label: 'Config',    icon: Settings        },
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
      <div className="min-h-screen bg-surface-2 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo-secretaria.jpg" alt="Logo" className="h-16 mx-auto mb-4 opacity-70 rounded-lg" />
          <p className="text-sm text-text-muted">Cargando SecretaríaOS…</p>
        </div>
      </div>
    )
  }

  if (!user) return <Login />

  const PageComponent = PAGE_MAP[page]

  return (
    <div className="flex flex-col h-screen bg-surface-2 md:flex-row">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-surface border-r border-border flex-col shrink-0">

        {/* Logo + nombre institución */}
        <div className="px-4 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <img
              src="/logo-secretaria.jpg"
              alt="Secretaría de Educación"
              className="h-10 w-10 rounded-lg object-cover shrink-0 shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-primary leading-tight">SecretaríaOS</p>
              <p className="text-[11px] text-text-muted leading-tight truncate mt-0.5">
                Educación, Cultura y Turismo
              </p>
              <p className="text-[10px] text-text-muted/70 leading-tight truncate">
                Ocaña, Norte de Santander
              </p>
            </div>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                page === id
                  ? 'bg-primary-light text-primary font-semibold'
                  : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', page === id ? 'text-primary' : 'text-text-muted')} />
              {label}
              {page === id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
        </nav>

        {/* Pie de sidebar */}
        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-text-muted truncate">{user.email}</p>
          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-2 text-xs text-text-muted hover:text-destructive transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ──────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <PageComponent />
      </main>

      {/* ── Bottom nav — móvil ───────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-border z-30
                      flex items-stretch h-16">
        {BOTTOM_PAGES.map(({ id, label, icon: Icon }) => {
          const active = page === id
          return (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={cn(
                'relative flex-1 flex flex-col items-center justify-center gap-0.5 pt-1 transition-colors',
                active ? 'text-primary' : 'text-text-muted'
              )}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon className="h-5 w-5" />
              <span className={cn('text-[10px] leading-tight', active && 'font-semibold')}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}
