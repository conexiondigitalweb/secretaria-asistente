import { useState } from 'react'
import { useFuncionarios } from '../hooks/useFuncionarios'
import ListaFuncionarios from '../components/configuracion/ListaFuncionarios'
import FormFuncionario from '../components/configuracion/FormFuncionario'
import Modal from '../components/ui/Modal'

export default function Configuracion() {
  const { funcionarios, loading, error, crearFuncionario, actualizarFuncionario, toggleActivo } = useFuncionarios()

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)   // null = crear, object = editar
  const [guardando, setGuardando]       = useState(false)
  const [errorMsg, setErrorMsg]         = useState(null)
  const [filtro, setFiltro]             = useState('todos') // 'todos' | 'activos' | 'inactivos'

  const funcionariosFiltrados = funcionarios.filter(f => {
    if (filtro === 'activos')   return f.activo
    if (filtro === 'inactivos') return !f.activo
    return true
  })

  const totalActivos = funcionarios.filter(f => f.activo).length

  function abrirCrear() {
    setEditando(null)
    setErrorMsg(null)
    setModalAbierto(true)
  }

  function abrirEditar(f) {
    setEditando(f)
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
        await actualizarFuncionario(editando.id, datos)
      } else {
        await crearFuncionario(datos)
      }
      cerrarModal()
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggle(id, activo) {
    setErrorMsg(null)
    try {
      await toggleActivo(id, activo)
    } catch (e) {
      setErrorMsg(e.message)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Gestión del despacho — Secretaría de Educación, Cultura y Turismo
        </p>
      </div>

      {/* ── Sección Funcionarios ─────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200">

        {/* Cabecera sección */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Funcionarios del despacho</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? '…' : `${totalActivos} activos · ${funcionarios.length - totalActivos} inactivos`}
            </p>
          </div>
          <button
            onClick={abrirCrear}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white
                       text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <span className="text-base leading-none">+</span>
            <span className="hidden sm:inline">Agregar funcionario</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        </div>

        {/* Filtros de estado */}
        <div className="flex gap-1 px-5 pt-3 pb-1">
          {[
            { value: 'todos',     label: 'Todos' },
            { value: 'activos',   label: 'Activos' },
            { value: 'inactivos', label: 'Inactivos' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFiltro(value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filtro === value
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200
                          rounded-lg px-3 py-2">
            {error.message}
          </div>
        )}
        {errorMsg && (
          <div className="mx-5 mt-3 text-xs text-red-600 bg-red-50 border border-red-200
                          rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Lista */}
        <div className="px-5 pb-4">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <ListaFuncionarios
              funcionarios={funcionariosFiltrados}
              onEditar={abrirEditar}
              onToggleActivo={handleToggle}
            />
          )}
        </div>
      </section>

      {/* Modal crear/editar */}
      <Modal
        open={modalAbierto}
        onClose={cerrarModal}
        title={editando ? `Editar — ${editando.nombre}` : 'Agregar funcionario'}
      >
        {errorMsg && (
          <div className="mb-4 text-xs text-red-600 bg-red-50 border border-red-200
                          rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}
        <FormFuncionario
          inicial={editando}
          onSubmit={handleGuardar}
          onCancel={cerrarModal}
          loading={guardando}
        />
      </Modal>

    </div>
  )
}
