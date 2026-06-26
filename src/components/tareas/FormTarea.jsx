import { useState } from 'react'
import { calcularFechaLimite, DIAS_HABILES_LIMITE } from '../../lib/utils'

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

// Días hábiles locales para tutelas en Ocaña (ajustable si el juez fija término distinto)
const DIAS_TUTELA_LOCAL = 2

function toLocalDateString(date) {
  // Construye YYYY-MM-DD en hora local, evitando el offset UTC
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const hoy = toLocalDateString(new Date())

const EMPTY = {
  tipo: 'peticion',
  origen: 'correo',
  asunto: '',
  descripcion: '',
  remitente: '',
  fecha_recibido: hoy,
  fecha_limite: '',
  prioridad: 'media',
  dias_tutela: DIAS_TUTELA_LOCAL,
}

function Field({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  )
}

const INPUT = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const SELECT = INPUT + ' bg-white'

/**
 * Recalcula la fecha límite según tipo, fecha recibido y días override (solo tutelas).
 */
function recalcularLimite(tipo, fechaRecibido, diasTutela) {
  if (!fechaRecibido) return ''
  // Para fecha_recibido que viene de <input type="date"> como "YYYY-MM-DD",
  // construir Date en hora local para evitar desfase UTC
  const [y, mo, d] = fechaRecibido.split('-').map(Number)
  const desde = new Date(y, mo - 1, d)
  const override = tipo === 'tutela' ? Number(diasTutela) : undefined
  const limite = calcularFechaLimite(tipo, desde, override)
  return limite ? toLocalDateString(limite) : ''
}

/**
 * @param {{ onSubmit: (data: object) => void, onCancel: () => void, loading?: boolean }} props
 */
export default function FormTarea({ onSubmit, onCancel, loading = false }) {
  const [form, setForm] = useState(EMPTY)

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      // Recalcular fecha límite cuando cambia tipo, fecha o días de tutela
      if (field === 'tipo' || field === 'fecha_recibido' || field === 'dias_tutela') {
        next.fecha_limite = recalcularLimite(next.tipo, next.fecha_recibido, next.dias_tutela)
      }

      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const [y, mo, d] = form.fecha_recibido.split('-').map(Number)
    const data = {
      ...form,
      fecha_recibido: new Date(y, mo - 1, d).toISOString(),
      fecha_limite: form.fecha_limite
        ? (() => { const [fy,fm,fd] = form.fecha_limite.split('-').map(Number); return new Date(fy,fm-1,fd).toISOString() })()
        : null,
      estado: 'pendiente',
      // dias_tutela es solo UI, no se persiste en BD
      dias_tutela: undefined,
    }
    onSubmit(data)
  }

  const esTutela = form.tipo === 'tutela'
  const diasDefault = DIAS_HABILES_LIMITE[form.tipo]

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

      {/* Panel de término tutela — solo visible cuando tipo === tutela */}
      {esTutela && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-red-700">⚖️ Término de tutela</p>
              <p className="text-xs text-red-500 mt-0.5">
                Término legal: 10 días hábiles (Dto. 2591/1991).
                Estándar local Ocaña: {DIAS_TUTELA_LOCAL} días hábiles.
                Ajusta si el juez fija un término distinto.
              </p>
            </div>
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <label className="text-xs font-medium text-red-700 whitespace-nowrap">Días hábiles</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.dias_tutela}
                onChange={e => set('dias_tutela', e.target.value)}
                className="w-16 text-center border border-red-300 rounded-lg px-2 py-1.5 text-sm font-bold text-red-700 bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
          </div>
        </div>
      )}

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
        <Field
          label="Fecha límite"
          hint={
            esTutela
              ? `Calculada con ${form.dias_tutela} días hábiles desde recibido`
              : diasDefault
                ? `Calculada con ${diasDefault} días hábiles (Ley 1755/2015)`
                : 'Opcional — sin término legal fijo'
          }
        >
          <input
            type="date"
            className={INPUT}
            value={form.fecha_limite}
            onChange={e => set('fecha_limite', e.target.value)}
          />
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
                    : p === 'alta'   ? 'bg-orange-500 text-white border-orange-500'
                    : p === 'media'  ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
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
