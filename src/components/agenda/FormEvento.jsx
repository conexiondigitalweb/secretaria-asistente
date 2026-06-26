import { useState, useEffect } from 'react'
import { useFuncionarios } from '../../hooks/useFuncionarios'

const TIPOS = ['reunion', 'compromiso', 'recordatorio', 'evento']
const TIPO_LABEL = {
  reunion: 'Reunión', compromiso: 'Compromiso', recordatorio: 'Recordatorio', evento: 'Evento',
}

const INPUT  = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-blue-500'
const SELECT = INPUT + ' bg-white'

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

function toLocalDT(date) {
  // Convierte Date a string "YYYY-MM-DDTHH:MM" para input datetime-local
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}

function ahora() {
  const d = new Date(); d.setMinutes(0, 0, 0); return toLocalDT(d)
}
function unaHoraDespues(dt) {
  const d = new Date(dt); d.setHours(d.getHours() + 1); return toLocalDT(d)
}

const EMPTY = {
  titulo: '', descripcion: '', tipo: 'reunion',
  fecha_inicio: ahora(), fecha_fin: unaHoraDespues(ahora()),
  lugar: '', delegado_id: '',
}

/**
 * @param {{
 *   inicial?: object,
 *   onSubmit: (data: object) => void,
 *   onCancel: () => void,
 *   loading?: boolean,
 * }} props
 */
export default function FormEvento({ inicial, onSubmit, onCancel, loading = false }) {
  const { funcionarios } = useFuncionarios({ soloActivos: true })
  const [form, setForm]  = useState(EMPTY)

  useEffect(() => {
    if (inicial) {
      setForm({
        titulo:       inicial.titulo ?? '',
        descripcion:  inicial.descripcion ?? '',
        tipo:         inicial.tipo ?? 'reunion',
        fecha_inicio: inicial.fecha_inicio ? toLocalDT(new Date(inicial.fecha_inicio)) : ahora(),
        fecha_fin:    inicial.fecha_fin    ? toLocalDT(new Date(inicial.fecha_fin))    : '',
        lugar:        inicial.lugar ?? '',
        delegado_id:  inicial.delegado_id ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [inicial])

  const set = (k, v) => setForm(p => ({
    ...p, [k]: v,
    // Ajustar fecha_fin si fecha_inicio se adelanta más allá de fin
    ...(k === 'fecha_inicio' && p.fecha_fin && v > p.fecha_fin
      ? { fecha_fin: unaHoraDespues(v) }
      : {}),
  }))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      titulo:      form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      tipo:        form.tipo,
      fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      fecha_fin:    form.fecha_fin ? new Date(form.fecha_fin).toISOString() : null,
      lugar:        form.lugar.trim() || null,
      delegado_id:  form.delegado_id || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Título + Tipo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Field label="Título" required>
            <input className={INPUT} value={form.titulo}
              onChange={e => set('titulo', e.target.value)} required
              placeholder="Ej: Reunión Consejo de Gobierno" />
          </Field>
        </div>
        <Field label="Tipo">
          <select className={SELECT} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </Field>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Inicio" required>
          <input type="datetime-local" className={INPUT}
            value={form.fecha_inicio}
            onChange={e => set('fecha_inicio', e.target.value)} required />
        </Field>
        <Field label="Fin">
          <input type="datetime-local" className={INPUT}
            value={form.fecha_fin} min={form.fecha_inicio}
            onChange={e => set('fecha_fin', e.target.value)} />
        </Field>
      </div>

      {/* Lugar + Delegado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Lugar">
          <input className={INPUT} value={form.lugar}
            onChange={e => set('lugar', e.target.value)}
            placeholder="Ej: Sala de juntas — Alcaldía" />
        </Field>

        <Field label="Delegado / Responsable">
          <select className={SELECT} value={form.delegado_id}
            onChange={e => set('delegado_id', e.target.value)}>
            <option value="">— Sin asignar —</option>
            {funcionarios.map(f => (
              <option key={f.id} value={f.id}>
                {f.nombre} · {f.cargo}
              </option>
            ))}
          </select>
          {funcionarios.length === 0 && (
            <span className="text-xs text-slate-400 mt-0.5">
              Registra funcionarios en Configuración para asignar delegados.
            </span>
          )}
        </Field>
      </div>

      {/* Descripción */}
      <Field label="Descripción / Notas">
        <textarea className={INPUT + ' resize-none'} rows={2}
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          placeholder="Detalles adicionales…" />
      </Field>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600
                     hover:bg-slate-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                     hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Crear evento'}
        </button>
      </div>
    </form>
  )
}
