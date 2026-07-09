/**
 * BorradorCard — tarjeta de un borrador pendiente de aprobación.
 *
 * Muestra: remitente, asunto, badge de clasificación, resumen
 * y datos extraídos relevantes (radicado, fecha límite, lugar/hora).
 *
 * Fix NUEVO: el usuario puede CAMBIAR la clasificación antes de aprobar.
 * El badge y el botón de aprobación se actualizan dinámicamente.
 *
 * Acciones: Aprobar (crea tarea/evento) | Rechazar (descarta).
 */

import { useState } from 'react'
import { Check, X, Info, Clock, MapPin, Hash, ChevronDown } from 'lucide-react'

// Configuración visual por clasificación
const BADGE = {
  tutela:       { label: 'Tutela',       bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-200'   },
  peticion:     { label: 'Petición',     bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200'},
  queja:        { label: 'Queja',        bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200'},
  convocatoria: { label: 'Convocatoria', bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-200'  },
  informativo:  { label: 'Informativo',  bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200'  },
  spam:         { label: 'Spam',         bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200'  },
}

const CLASIFICACIONES = [
  { value: 'tutela',       label: 'Tutela'       },
  { value: 'peticion',     label: 'Petición'     },
  { value: 'queja',        label: 'Queja'        },
  { value: 'convocatoria', label: 'Convocatoria' },
  { value: 'informativo',  label: 'Informativo'  },
  { value: 'spam',         label: 'Spam'         },
]

function formatearFecha(isoString) {
  if (!isoString) return null
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function formatearFechaCorta(isoString) {
  if (!isoString) return null
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString
  }
}

function extractEmail(remitente) {
  const match = remitente?.match(/<(.+?)>/)
  return match ? match[1] : remitente ?? '(desconocido)'
}

function extractNombre(remitente) {
  const match = remitente?.match(/^(.+?)\s*</)
  return match ? match[1].trim().replace(/^"|"$/g, '') : null
}

export default function BorradorCard({ borrador, onAprobar, onRechazar, procesando }) {
  // Override de clasificación: si el usuario cambia la clasificación de la IA
  const [claseOverride, setClaseOverride] = useState(null)
  const [showOverride, setShowOverride]   = useState(false)

  const clasificacionEfectiva = claseOverride ?? borrador.clasificacion
  const cambioAplicado        = claseOverride && claseOverride !== borrador.clasificacion

  const badge  = BADGE[clasificacionEfectiva] ?? BADGE.informativo
  const datos  = borrador.datos_extraidos ?? {}
  const nombre = extractNombre(borrador.remitente)
  const email  = extractEmail(borrador.remitente)

  // Convocatoria sin fecha: aviso informativo, pero el botón sigue habilitado
  // (al aprobar, se abrirá FormEvento para ingresar la fecha)
  const esConvocatoria      = clasificacionEfectiva === 'convocatoria'
  const convocatoriaSinFecha = esConvocatoria && !datos.fecha_hora_reunion

  function handleCambiarClase(nuevaClase) {
    setClaseOverride(nuevaClase === borrador.clasificacion ? null : nuevaClase)
    setShowOverride(false)
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-opacity ${procesando ? 'opacity-50 pointer-events-none' : ''}`}>

      {/* ── Encabezado: badge + confianza + duplicado ── */}
      <div className="flex items-start gap-2 flex-wrap">
        {/* Badge de clasificación (efectiva, puede ser override) */}
        <span className={`
          shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border
          ${badge.bg} ${badge.text} ${badge.border}
        `}>
          {badge.label}
          {cambioAplicado && <span className="ml-1 opacity-70">(editado)</span>}
        </span>

        {/* Confianza — solo si no fue overrideado */}
        {borrador.confianza != null && !cambioAplicado && (
          <span className="shrink-0 text-[11px] text-text-muted">
            {Math.round(borrador.confianza * 100)}%
          </span>
        )}

        {/* Duplicado */}
        {datos.es_duplicado && (
          <span className="shrink-0 text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
            ⚠ Radicado duplicado
          </span>
        )}

        {/* Botón para cambiar clasificación */}
        <button
          type="button"
          onClick={() => setShowOverride(v => !v)}
          className="ml-auto shrink-0 flex items-center gap-0.5 text-[11px] text-text-muted
                     hover:text-primary transition-colors"
          title="Cambiar clasificación"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showOverride ? 'rotate-180' : ''}`} />
          {cambioAplicado ? 'cambiar de nuevo' : 'cambiar clasificación'}
        </button>
      </div>

      {/* ── Override selector ── */}
      {showOverride && (
        <div className="flex flex-wrap gap-1 p-2 bg-surface-3 rounded-lg border border-border">
          <p className="w-full text-[11px] text-text-muted mb-1">
            Clasificación original de la IA: <strong>{BADGE[borrador.clasificacion]?.label ?? borrador.clasificacion}</strong>
          </p>
          {CLASIFICACIONES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => handleCambiarClase(c.value)}
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors
                ${clasificacionEfectiva === c.value
                  ? `${BADGE[c.value].bg} ${BADGE[c.value].text} ${BADGE[c.value].border}`
                  : 'bg-white text-text-muted border-border hover:border-primary hover:text-primary'
                }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Asunto + remitente ── */}
      <div>
        <p className="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
          {borrador.asunto ?? '(sin asunto)'}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {nombre && <span className="font-medium text-text-secondary">{nombre} · </span>}
          {email}
        </p>
      </div>

      {/* ── Resumen ── */}
      {borrador.cuerpo_resumen && (
        <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
          {borrador.cuerpo_resumen}
        </p>
      )}

      {/* ── Datos extraídos ── */}
      {(datos.numero_radicado || datos.fecha_limite || datos.lugar || datos.fecha_hora_reunion) && (
        <div className="flex flex-wrap gap-2">

          {datos.numero_radicado && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted bg-surface-3 px-2 py-0.5 rounded-full">
              <Hash className="h-3 w-3" />
              Radicado {datos.numero_radicado}
            </span>
          )}

          {datos.fecha_limite && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted bg-surface-3 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              Límite {formatearFechaCorta(datos.fecha_limite)}
            </span>
          )}

          {datos.lugar && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted bg-surface-3 px-2 py-0.5 rounded-full">
              <MapPin className="h-3 w-3" />
              {datos.lugar}
            </span>
          )}

          {datos.fecha_hora_reunion && (
            <span className="flex items-center gap-1 text-[11px] text-text-muted bg-surface-3 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" />
              {formatearFecha(datos.fecha_hora_reunion)}
            </span>
          )}
        </div>
      )}

      {/* Aviso informativo: convocatoria sin fecha — ya no bloquea, solo avisa */}
      {convocatoriaSinFecha && (
        <div className="flex items-start gap-1.5 text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>No se encontró fecha en el correo — podrás ingresarla al aprobar.</span>
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onAprobar(borrador, claseOverride)}
          disabled={procesando}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                     bg-primary text-white hover:bg-primary/90 transition-colors
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="h-3.5 w-3.5" />
          {esConvocatoria ? 'Aprobar y crear evento' : 'Aprobar y crear tarea'}
        </button>

        <button
          onClick={() => onRechazar(borrador)}
          disabled={procesando}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
                     border border-border text-text-muted hover:border-red-300 hover:text-red-600
                     transition-colors disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          Rechazar
        </button>
      </div>
    </div>
  )
}
