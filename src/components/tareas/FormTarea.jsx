import { useState } from 'react'
import { calcularFechaLimite, DIAS_HABILES_LIMITE } from '../../lib/utils'
import { verificarRadicado, vincularCorreoATarea } from '../../lib/tutelas'
import AlertaDuplicado from './AlertaDuplicado'

const TIPOS      = ['tutela', 'peticion', 'queja', 'solicitud', 'reunion', 'tarea', 'otro']
const ORIGENES   = ['correo', 'fisico', 'verbal', 'whatsapp', 'otro']
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

const DIAS_TUTELA_LOCAL = 2

function toLocalDateString(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseFechaLocal(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function recalcularLimite(tipo, fechaRecibido, diasTutela) {
  if (!fechaRecibido) return ''
  const override = tipo === 'tutela' ? Number(diasTutela) : undefined
  const limite = calcularFechaLimite(tipo, parseFechaLocal(fechaRecibido), override)
  return limite ? toLocalDateString(limite) : ''
}

const EMPTY = {
  tipo: 'peticion',
  origen: 'correo',
  asunto: '',
  descripcion: '',
  remitente: '',
  fecha_recibido: toLocalDateString(new Date()),
  fecha_limite: '',
  prioridad: 'media',
  dias_tutela: DIAS_TUTELA_LOCAL,
  radicado: '',
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

const INPUT  = 'border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
const SELECT = INPUT + ' bg-white'

/**
 * @param {{
 *   onSubmit: (data: object) => void,
 *   onCancel: () => void,
 *   loading?: boolean,
 *   correoId?: string,   — ID de Gmail si el form se abre desde un correo (Fase 3)
 * }} props
 */
export default function FormTarea({ onSubmit, onCancel, loading = false, correoId }) {
  const [form, setForm]             = useState(EMPTY)
  const [verificando, setVerificando] = useState(false)
  const [vinculando, setVinculando]   = useState(false)
  const [duplicado, setDuplicado]     = useState(null)   // tarea existente si hay duplicado
  const [errorMsg, setErrorMsg]       = useState(null)
  const [forzarNueva, setForzarNueva] = useState(false)  // usuario eligió crear de todas formas

  function set(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'tipo' || field === 'fecha_recibido' || field === 'dias_tutela') {
        next.fecha_limite = recalcularLimite(next.tipo, next.fecha_recibido, next.dias_tutela)
      }
      // Si cambia el radicado, limpiar estado de duplicado anterior
      if (field === 'radicado') {
        setDuplicado(null)
        setForzarNueva(false)
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg(null)

    // Verificar duplicado solo en tutelas con radicado, a menos que el usuario ya eligió forzar
    if (form.tipo === 'tutela' && form.radicado.trim() && !forzarNueva) {
      setVerificando(true)
      const { tarea, error } = await verificarRadicado(form.radicado.trim())
      setVerificando(false)

      if (error) {
        setErrorMsg('Error al verificar radicado: ' + error.message)
        return
      }
      if (tarea) {
        setDuplicado(tarea)
        return  // Mostrar alerta — no continuar con la creación
      }
    }

    guardarTarea()
  }

  function guardarTarea() {
    const data = {
      tipo:           form.tipo,
      origen:         form.origen,
      asunto:         form.asunto,
      descripcion:    form.descripcion || null,
      remitente:      form.remitente   || null,
      fecha_recibido: parseFechaLocal(form.fecha_recibido).toISOString(),
      fecha_limite:   form.fecha_limite ? parseFechaLocal(form.fecha_limite).toISOString() : null,
      prioridad:      form.prioridad,
      estado:         'pendiente',
      radicado:       form.tipo === 'tutela' && form.radicado.trim() ? form.radicado.trim() : null,
      correo_id:      correoId ?? null,
    }
    onSubmit(data)
  }

  async function handleVincular() {
    if (!correoId || !duplicado) return
    setVinculando(true)
    const { error } = await vincularCorreoATarea(duplicado.id, correoId)
    setVinculando(false)
    if (error) {
      setErrorMsg('Error al vincular: ' + error.message)
      return
    }
    onCancel() // Cerrar formulario — ya se vinculó
  }

  function handleCrearNueva() {
    setForzarNueva(true)
    setDuplicado(null)
    // Reenviar el submit sin verificación
    guardarTarea()
  }

  const esTutela   = form.tipo === 'tutela'
  const diasDefault = DIAS_HABILES_LIMITE[form.tipo]

  // ── Pantalla de duplicado ─────────────────────────────────────────────────
  if (duplicado) {
    return (
      <AlertaDuplicado
        tareaExistente={duplicado}
        radicado={form.radicado.trim()}
        correoId={correoId}
        onVincular={handleVincular}
        onCrearNueva={handleCrearNueva}
        onCancelar={() => { setDuplicado(null); setForzarNueva(false) }}
        vinculando={vinculando}
      />
    )
  }

  // ── Formulario normal ─────────────────────────────────────────────────────
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

      {/* Panel tutela: término + radicado */}
      {esTutela && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col gap-3">
          {/* Término */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-red-700">⚖️ Término de tutela</p>
              <p className="text-xs text-red-500 mt-0.5">
                Término legal: 10 días hábiles (Dto. 2591/1991). Estándar Ocaña: {DIAS_TUTELA_LOCAL} días.
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

          {/* Radicado */}
          <div className="border-t border-red-200 pt-3">
            <Field
              label="Número de radicado"
              hint="Ej: 11001-22-03-000-2026-00123-00 — se verificará duplicado al guardar"
            >
              <input
                className={`${INPUT} font-mono`}
                placeholder="Ej: 54001-40-89-001-2026-00045-00"
                value={form.radicado}
                onChange={e => set('radicado', e.target.value)}
              />
            </Field>
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

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

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
          disabled={loading || verificando}
          className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {verificando ? 'Verificando radicado…' : loading ? 'Guardando…' : 'Guardar tarea'}
        </button>
      </div>
    </form>
  )
}
