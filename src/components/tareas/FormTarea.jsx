import { useState } from 'react'
import { calcularFechaLimite } from '../../lib/utils'

const TIPOS = ['tutela', 'peticion', 'queja', 'solicitud', 'reunion', 'tarea', 'otro']
const ORIGENES = ['correo', 'fisico', 'verbal', 'whatsapp', 'otro']
const PRIORIDADES = ['critica', 'alta', 'media', 'baja']

const TIPO_LABEL = {
  tutela: 'Tutela', peticion: 'Petición', queja: 'Queja', solicitud: 'Solicitud',
  reunion: 'Reunión', tarea: 'Tarea', otro: 'Otro',
}
const ORIGEN_LABEL = {
  correo: 'Correo', fisico: 'Físico', verbal: 'Verbal', whatsapp: 'WhatsApp', otro: 'Otro',
}
const PRIORIDAD_LABEL = {
  critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja',
}

const EMPTY = {
  tipo: 'peticion',
  origen: 'correo',
  asunto: '',
  descripcion: '',
  remitente: '',
  fecha_recibido: new Date().toISOString().slice(0, 10),
  fecha_limite: '',
  prioridad: 'media',
}

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const SELECT = INPUT + ' bg-white'

/**
 * @param {{ onSubmit: (data: object) => void, onCancel: () => void, loading?: boolean }} props
 */
export default function FormTarea({ onSubmit, onCancel, loading = false }) {
  const [form, setForm] = useState(EMPTY)

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Recalcular fecha límite automáticamente cuando cambia tipo o fecha_recibido
      if ((field === 'tipo' || field === 'fecha_recibido') && next.fecha_recibido) {
        const limite = calcularFechaLimite(next.tipo, next.fecha_recibido)
        next.fecha_limite = limite ? limite.toISOString().slice(0, 10) : ''
      }
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = {
      ...form,
      fecha_recibido: form.fecha_recibido ? new Date(form.fecha_recibido).toISOString() : null,
      fecha_limite:   form.fecha_limite   ? new Date(form.fecha_limite).toISOString()   : null,
      estado: 'pendiente',
    }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Tipo + Origen */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" required>
          <select className={SELECT} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Origen">
          <select className={SELECT} value={form.origen} onChange={e => set('origen', e.target.value)}>
            {ORIGENES.map(o => <option key={o} value={o}>{ORIGEN_LABEL[o]}</option>)}
          </select>
        </Field>
      </div>

      {/* Asunto */}
      <Field label="Asunto" required>
        <input
          className={INPUT}
          placeholder="Descripción breve del caso"
          value={form.asunto}
          onChange={e => set('asunto', e.target.value)}
          required
        />
      </Field>

      {/* Remitente */}
      <Field label="Remitente">
        <input
          className={INPUT}
          placeholder="Nombre del ciudadano o entidad"
          value={form.remitente}
          onChange={e => set('remitente', e.target.value)}
        />
      </Field>

      {/* Descripción */}
      <Field label="Descripción">
        <textarea
          className={INPUT + ' resize-none'}
          rows={3}
          placeholder="Detalles adicionales del caso..."
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
        />
      </Field>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha recibido" required>
          <input
            type="date"
            className={INPUT}
            value={form.fecha_recibido}
            onChange={e => set('fecha_recibido', e.target.value)}
            required
          />
        </Field>
        <Field label="Fecha límite">
          <input
            type="date"
            className={INPUT}
            value={form.fecha_limite}
            onChange={e => set('fecha_limite', e.target.value)}
          />
          {form.tipo === 'tutela' && (
            <span className="text-xs text-red-600 mt-0.5">⚠ 10 días — improrrogable (Dto. 2591/1991)</span>
          )}
          {(form.tipo === 'peticion' || form.tipo === 'queja') && (
            <span className="text-xs text-orange-600 mt-0.5">15 días hábiles (Ley 1755/2015)</span>
          )}
        </Field>
      </div>

      {/* Prioridad */}
      <Field label="Prioridad">
        <div className="flex gap-2">
          {PRIORIDADES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => set('prioridad', p)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                form.prioridad === p
                  ? p === 'critica' ? 'bg-red-600 text-white border-red-600'
                    : p === 'alta' ? 'bg-orange-500 text-white border-orange-500'
                    : p === 'media' ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
                    : 'bg-slate-600 text-white border-slate-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {PRIORIDAD_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar tarea'}
        </button>
      </div>
    </form>
  )
}
