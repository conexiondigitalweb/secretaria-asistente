import { useState } from 'react'
import { useUserProfiles } from '../../hooks/useUserProfiles'

const ROLES = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'admin',  label: 'Administrador' },
]

export default function PanelUsuarios() {
  const { perfiles, loading, error, crearUsuario, actualizarRol, toggleActivo } = useUserProfiles()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol]           = useState('agenda')
  const [creando, setCreando]   = useState(false)
  const [errorCrear, setErrorCrear] = useState(null)
  const [okCrear, setOkCrear]       = useState(null)

  async function handleCrear(e) {
    e.preventDefault()
    setCreando(true)
    setErrorCrear(null)
    setOkCrear(null)
    try {
      const { user } = await crearUsuario({ username, password, role: rol })
      setOkCrear(`Usuario creado: ${user.email}`)
      setUsername('')
      setPassword('')
      setRol('agenda')
    } catch (e) {
      setErrorCrear(e.message)
    } finally {
      setCreando(false)
    }
  }

  async function handleCambiarRol(id, nuevoRol) {
    try {
      await actualizarRol(id, nuevoRol)
    } catch (e) {
      setErrorCrear(e.message)
    }
  }

  async function handleToggle(id, activo) {
    try {
      await toggleActivo(id, activo)
    } catch (e) {
      setErrorCrear(e.message)
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 mt-6">
      <div className="px-5 py-4 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-800">Usuarios y permisos</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Cuentas de asistentes con acceso limitado (usuario + contraseña, sin Google)
        </p>
      </div>

      {/* Formulario crear usuario */}
      <form onSubmit={handleCrear} className="p-5 border-b border-slate-200 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Usuario</label>
          <div className="flex items-stretch">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              placeholder="asistente1"
              className="border border-slate-200 rounded-l-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-xs text-slate-400 bg-slate-50 border border-l-0 border-slate-200 rounded-r-lg px-2 flex items-center whitespace-nowrap">
              @secretariaos.local
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Contraseña temporal</label>
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="mínimo 6 caracteres"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Rol</label>
          <select
            value={rol}
            onChange={e => setRol(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <button
          type="submit"
          disabled={creando}
          className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {creando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      {errorCrear && (
        <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorCrear}
        </div>
      )}
      {okCrear && (
        <div className="mx-5 mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {okCrear}
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="px-5 py-4">
        {loading ? (
          <p className="text-xs text-slate-400">Cargando usuarios…</p>
        ) : error ? (
          <p className="text-xs text-red-600">{error.message}</p>
        ) : perfiles.length === 0 ? (
          <p className="text-xs text-slate-400">No hay usuarios registrados todavía.</p>
        ) : (
          <div className="space-y-1">
            {perfiles.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">{p.display_name || p.id}</p>
                  <p className={`text-xs ${p.active ? 'text-green-600' : 'text-slate-400'}`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </p>
                </div>

                <select
                  value={p.role}
                  onChange={e => handleCambiarRol(p.id, e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs shrink-0"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>

                <button
                  onClick={() => handleToggle(p.id, !p.active)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                    p.active
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                >
                  {p.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
