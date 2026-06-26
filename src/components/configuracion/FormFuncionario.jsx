import { useState, useEffect } from 'react'

const TIPOS = ['planta', 'contratista']
const TIPO_LABEL = { planta: 'Planta', contratista: 'Contratista' }

const EMPTY = { nombre: '', cargo: '', tipo: 'planta', correo: '', whatsapp: '', activo: true }

const INPUT = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-blue-500'
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

/**
 * @param {{
 *   inicial?: object,
 *   onSubmit: (data: object) => void,
 *   onCancel: () => void,
 *   loading?: boolean,
 * }} props
 */
export default function FormFuncionario({ inicial, onSubmit, onCancel, loading = false }) {
  const [form, setForm] = useState(inicial ?? EMPTY)

  useEffect(() => { setForm(inicial ?? EMPTY) }, [inicial])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      nombre:   form.nombre.trim(),
      cargo:    form.cargo.trim(),
      tipo:     form.tipo,
      correo:   form.correo.trim()   || null,
      whatsapp: form.whatsapp.trim() || null,
      activo:   form.activo,
    })
  }

  const esEdicion = !!inicial

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre completo" required>
          <input className={INPUT} value={form.nombre}
            onChange={e => set('nombre', e.target.value)} required
            placeholder="Ej: María Elena Torres" />
        </Field>
        <Field label="Cargo" required>
          <input className={INPUT} value={form.cargo}
            onChange={e => set('cargo', e.target.value)} required
            placeholder="Ej: Profesional Universitario" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tipo de vinculación">
          <select className={SELECT} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="WhatsApp">
          <input className={INPUT} value={form.whatsapp ?? ''}
            onChange={e => set('whatsapp', e.target.value)}
            placeholder="Ej: 311 234 5678" type="tel" />
        </Field>
      </div>

      <Field label="Correo electrónico">
        <input className={INPUT} value={form.correo}
          onChange={e => set('correo', e.target.value)}
          placeholder="Ej: funcionario@ocana.gov.co" type="email" />
      </Field>

      {esEdicion && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.activo}
            onChange={e => set('activo', e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600" />
          <span className="text-sm text-slate-700">Funcionario activo</span>
        </label>
      )}

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {loading ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Agregar funcionario'}
        </button>
      </div>
    </form>
  )
}
