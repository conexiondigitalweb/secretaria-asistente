/**
 * FormEditarTarea — edición de una tarea existente.
 *
 * Diferencias clave respecto a FormTarea (creación):
 *  - Precarga todos los campos con los valores actuales.
 *  - No tiene detección de duplicados por radicado (el radicado ya fue validado al crear).
 *  - No tiene selector de origen (no cambia al editar).
 *  - Sí incluye campo radicado editable (por si el modelo lo extrajo mal).
 *  - El cálculo de fecha_limite se puede recalcular manualmente o editar directo.
 *  - No envía notificaciones automáticas al guardar (solo guarda el cambio).
 */

import { useState, useEffect } from 'react'
import { calcularFechaLimite, DIAS_HABILES_LIMITE } from '../../lib/utils'
import { useFuncionarios } from '../../hooks/useFuncionarios'

const TIPOS       = ['tutela', 'peticion', 'queja', 'solicitud', 'reunion', 'tarea', 'otro']
const ESTADOS     = ['pendiente', 'en_proceso', 'resuelto', 'vencido']
const PRIORIDADES = ['critica', 'alta', 'media', 'baja']

const TIPO_LABEL = {
  tutela: 'Tutela', peticion: 'Petición', queja: 'Queja', solicitud: 'Solicitud',
  reunion: 'Reunión', tarea: 'Tarea', otro: 'Otro',
}
const ESTADO_LABEL = {
  pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto', vencido: 'Vencido',
}
const PRIORIDAD_LABEL = {
  critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja',
}

const INPUT  = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent'
const SELECT = INPUT + ' bg-white'

function toLocalDateString(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseFechaLocal(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
  )
}

/**
 * @param {{
 *   tarea: object,
 *   onSubmit: (cambios: object) => void,
 *   onCancel: () => void,
 *   loading?: boolean,
 * }} props
 */
export default function FormEditarTarea({ tarea, onSubmit, onCancel, loading = false }) {
  const { funcionarios } = useFuncionarios({ soloActivos: true })

  const [form, setForm] = useState({
    asunto:        '',
    descripcion:   '',
    remitente:     '',
    tipo:          'peticion',
    estado:        'pendiente',
    prioridad:     'media',
    fecha_recibido: '',
    fecha_limite:  '',
    radicado:      '',
    funcionario_id: '',
  })

  // Precargar valores actuales de la tarea
  useEffect(() => {
    if (!tarea) return
    setForm({
      asunto:         tarea.asunto         ?? '',
      descripcion:    tarea.descripcion    ?? '',
      remitente:      tarea.remitente      ?? '',
      tipo:           tarea.tipo           ?? 'peticion',
      estado:         tarea.estado         ?? 'pendiente',
      prioridad:      tarea.prioridad      ?? 'media',
      fecha_recibido: tarea.fecha_recibido ? toLocalDateString(tarea.fecha_recibido) : '',
      fecha_limite:   tarea.fecha_limite   ? toLocalDateString(tarea.fecha_limite)   : '',
      radicado:       tarea.radicado       ?? '',
      funcionario_id: tarea.funcionario_id ?? '',
    })
  }, [tarea?.id])

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function recalcularFechaLimite() {
    if (!form.fecha_recibido || !form.tipo) return
    const limite = calcularFechaLimite(form.tipo, parseFechaLocal(form.fecha_recibido))
    if (limite) set('fecha_limite', toLocalDateString(limite))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const cambios = {
      asunto:         form.asunto.trim(),
      descripcion:    form.descripcion.trim() || null,
      remitente:      form.remitente.trim()   || null,
      tipo:           form.tipo,
      estado:         form.estado,
      prioridad:      form.prioridad,
      fecha_recibido: parseFechaLocal(form.fecha_recibido)?.toISOString() ?? tarea.fecha_recibido,
      fecha_limite:   form.fecha_limite ? parseFechaLocal(form.fecha_limite).toISOString() : null,
      radicado:       form.tipo === 'tutela' && form.radicado.trim()
                        ? form.radicado.trim()
                        : (form.radicado.trim() || null),
      funcionario_id: form.funcionario_id || null,
    }
    onSubmit(cambios)
  }

  const esTutela     = form.tipo === 'tutela'
  const diasDefault  = DIAS_HABILES_LIMITE[form.tipo]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Asunto */}
      <Field label="Asunto *">
        <input
          className={INPUT}
          value={form.asunto}
          onChange={e => set('asunto', e.target.value)}
          placeholder="Descripción breve del caso"
          required
        />
      </Field>

      {/* Tipo + Estado */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select className={SELECT} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select className={SELECT} value={form.estado} onChange={e => set('estado', e.target.value)}>
            {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
        </Field>
      </div>

      {/* Panel tutela: radicado */}
      {esTutela && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-700 mb-2">⚖️ Tutela</p>
          <Field
            label="Número de radicado"
            hint="Editable — no se verifica duplicado al editar"
          >
            <input
              className={`${INPUT} font-mono`}
              placeholder="Ej: 54001-40-89-001-2026-00045-00"
              value={form.radicado}
              onChange={e => set('radicado', e.target.value)}
            />
          </Field>
        </div>
      )}

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
      <Field label="Descripción / Notas">
        <textarea
          className={INPUT + ' resize-none'}
          rows={3}
          placeholder="Detalles adicionales del caso…"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
        />
      </Field>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha recibido">
          <input
            type="date"
            className={INPUT}
            value={form.fecha_recibido}
            onChange={e => set('fecha_recibido', e.target.value)}
          />
        </Field>
        <Field
          label="Fecha límite"
          hint={diasDefault ? `${diasDefault} días hábiles por ley` : 'Sin término legal fijo'}
        >
          <div className="flex gap-1">
            <input
              type="date"
              className={INPUT}
              value={form.fecha_limite}
              onChange={e => set('fecha_limite', e.target.value)}
            />
            <button
              type="button"
              onClick={recalcularFechaLimite}
              title="Recalcular fecha límite desde la fecha de recibido"
              className="shrink-0 px-2 py-1 rounded-lg border border-slate-200 text-slate-500
                         hover:bg-slate-50 hover:text-primary transition-colors text-xs"
            >
              ↺
            </button>
          </div>
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
                  ? p === 'critica' ? 'bg-red-600     text-white      border-red-600'
                  : p === 'alta'    ? 'bg-orange-500  text-white      border-orange-500'
                  : p === 'media'   ? 'bg-yellow-400  text-yellow-900 border-yellow-400'
                  :                   'bg-slate-600   text-white      border-slate-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {PRIORIDAD_LABEL[p]}
            </button>
          ))}
        </div>
      </Field>

      {/* Funcionario */}
      <Field label="Funcionario asignado">
        <select
          className={SELECT}
          value={form.funcionario_id}
          onChange={e => set('funcionario_id', e.target.value)}
        >
          <option value="">— Sin asignar —</option>
          {funcionarios.map(f => (
            <option key={f.id} value={f.id}>{f.nombre} · {f.cargo}</option>
          ))}
        </select>
      </Field>

      {/* Acciones */}
      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600
                     hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !form.asunto.trim()}
          className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium
                     hover:bg-primary-hover disabled:opacity-50 transition-colors"
        >
          {loading ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
