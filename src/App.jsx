import { useState } from 'react'
import Dashboard from './pages/Dashboard'
import Tareas from './pages/Tareas'
import Agenda from './pages/Agenda'
import Documentos from './pages/Documentos'
import Configuracion from './pages/Configuracion'

const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'tareas', label: 'Tareas', icon: '📋' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'documentos', label: 'Documentos', icon: '📄' },
  { id: 'configuracion', label: 'Configuración', icon: '⚙️' },
]

const PAGE_MAP = {
  dashboard: Dashboard,
  tareas: Tareas,
  agenda: Agenda,
  documentos: Documentos,
  configuracion: Configuracion,
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const PageComponent = PAGE_MAP[page]

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
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
          <p className="text-xs text-slate-400">Ocaña, Norte de Santander</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <PageComponent />
      </main>
    </div>
  )
}
