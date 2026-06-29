/**
 * FormDocumento — carga un PDF institucional con:
 *  1. Subida a Supabase Storage
 *  2. Extracción de texto con pdfjs-dist
 *  3. Generación de embedding via /api/generate-embedding
 *  4. Almacenamiento en tabla documentos (con embedding + contenido)
 */
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/cn'
import { Upload, FileText, X, Loader2, CheckCircle2 } from 'lucide-react'

const TIPOS = [
  { value: 'plan_desarrollo',  label: 'Plan de Desarrollo' },
  { value: 'plan_accion',      label: 'Plan de Acción' },
  { value: 'normativa',        label: 'Normativa / Decreto' },
  { value: 'informe',          label: 'Informe' },
  { value: 'otro',             label: 'Otro' },
]

const PASOS = [
  'Subiendo archivo…',
  'Extrayendo texto…',
  'Generando embedding…',
  'Guardando en base de datos…',
]

export default function FormDocumento({ onCreado, onCancelar }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({ nombre: '', tipo: 'plan_desarrollo', descripcion: '' })
  const [archivo, setArchivo] = useState(null)
  const [estado, setEstado] = useState('idle')   // idle | procesando | ok | error
  const [paso, setPaso]     = useState(0)
  const [error, setError]   = useState(null)

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.type !== 'application/pdf') {
      setError('Solo se aceptan archivos PDF.')
      return
    }
    if (f.size > 52428800) {
      setError('El archivo supera el límite de 50 MB.')
      return
    }
    setArchivo(f)
    setError(null)
    if (!form.nombre) setForm(prev => ({ ...prev, nombre: f.name.replace(/\.pdf$/i, '') }))
  }

  async function extraerTextoPDF(file) {
    // Carga pdfjs-dist dinámicamente (evita bundle en páginas que no lo usan)
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const paginas = pdf.numPages
    const textos = []

    for (let i = 1; i <= paginas; i++) {
      const page    = await pdf.getPage(i)
      const content = await page.getTextContent()
      const texto   = content.items.map(item => item.str).join(' ')
      textos.push(texto)
    }

    return { texto: textos.join('\n\n'), paginas }
  }

  async function generarEmbedding(texto) {
    const res = await fetch('/api/generate-embedding', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: texto, input_type: 'document' }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error ?? 'Error generando embedding')
    }
    const data = await res.json()
    return data.embedding
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!archivo) { setError('Selecciona un archivo PDF.'); return }
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return }

    setEstado('procesando')
    setError(null)
    setPaso(0)

    try {
      // 1 — Subir PDF a Storage
      const ext      = 'pdf'
      const fileName = `${Date.now()}-${archivo.name.replace(/[^a-z0-9._-]/gi, '_')}`
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('documentos-institucionales')
        .upload(fileName, archivo, { contentType: 'application/pdf', upsert: false })

      if (storageErr) throw new Error(`Storage: ${storageErr.message}`)
      const { data: { publicUrl } } = supabase.storage
        .from('documentos-institucionales')
        .getPublicUrl(fileName)

      setPaso(1)

      // 2 — Extraer texto del PDF
      const { texto, paginas } = await extraerTextoPDF(archivo)

      setPaso(2)

      // 3 — Generar embedding
      const embedding = await generarEmbedding(texto)

      setPaso(3)

      // 4 — Guardar en documentos
      const { data: doc, error: dbErr } = await supabase
        .from('documentos')
        .insert([{
          nombre:      form.nombre.trim(),
          tipo:        form.tipo,
          descripcion: form.descripcion.trim() || null,
          archivo_url: publicUrl,
          contenido:   texto.slice(0, 200000),
          paginas,
          tamano_kb:   Math.round(archivo.size / 1024),
          embedding,
          procesado:   true,
          vigente:     true,
        }])
        .select()
        .single()

      if (dbErr) throw new Error(`DB: ${dbErr.message}`)

      setEstado('ok')
      setTimeout(() => onCreado?.(doc), 1200)

    } catch (err) {
      setError(err.message)
      setEstado('error')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <CheckCircle2 className="h-12 w-12 text-primary" />
        <p className="text-sm font-semibold text-text-primary">Documento cargado correctamente</p>
        <p className="text-xs text-text-muted">Embedding generado y listo para consultas</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Nombre */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Nombre del documento <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={form.nombre}
          onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
          placeholder="Ej: Plan de Desarrollo 2024-2027"
          className="w-full text-sm px-3 py-2 rounded-lg border border-border-input bg-surface
                     text-text-primary placeholder:text-text-muted
                     focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
        />
      </div>

      {/* Tipo */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
        <select
          value={form.tipo}
          onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
          className="w-full text-sm px-3 py-2 rounded-lg border border-border-input bg-surface
                     text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Descripción (opcional)</label>
        <textarea
          rows={2}
          value={form.descripcion}
          onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
          placeholder="Breve descripción del contenido…"
          className="w-full text-sm px-3 py-2 rounded-lg border border-border-input bg-surface
                     text-text-primary placeholder:text-text-muted resize-none
                     focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Archivo */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Archivo PDF <span className="text-destructive">*</span>
        </label>

        {archivo ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-primary bg-primary-lighter">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-text-primary flex-1 truncate">{archivo.name}</span>
            <span className="text-xs text-text-muted shrink-0">
              {(archivo.size / 1024 / 1024).toFixed(1)} MB
            </span>
            <button
              type="button"
              onClick={() => { setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
              className="text-text-muted hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed
                       border-border hover:border-primary hover:bg-primary-lighter transition-colors"
          >
            <Upload className="h-6 w-6 text-text-muted" />
            <span className="text-sm text-text-muted">Clic para seleccionar PDF</span>
            <span className="text-xs text-text-muted">Máx. 50 MB</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,application/pdf"
               onChange={handleFile} className="hidden" />
      </div>

      {/* Progreso */}
      {estado === 'procesando' && (
        <div className="rounded-lg bg-primary-lighter border border-primary/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            <span className="text-sm font-medium text-primary">{PASOS[paso]}</span>
          </div>
          <div className="flex gap-1">
            {PASOS.map((_, i) => (
              <div key={i}
                   className={cn('flex-1 h-1 rounded-full transition-colors',
                     i <= paso ? 'bg-primary' : 'bg-border')} />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Botones */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancelar}
          disabled={estado === 'procesando'}
          className="px-4 py-2 text-sm rounded-lg border border-border text-text-secondary
                     hover:bg-surface-3 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={estado === 'procesando' || !archivo}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white font-medium
                     hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2"
        >
          {estado === 'procesando' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {estado === 'procesando' ? 'Procesando…' : 'Cargar documento'}
        </button>
      </div>
    </form>
  )
}
