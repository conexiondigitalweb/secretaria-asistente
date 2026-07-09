import getColombiaHolidays from 'colombia-holiday'

// ─── Cache de festivos por año ───────────────────────────────────────────────
// Evita recalcular el mismo año repetidamente
const _cacheFestivos = {}

/**
 * Retorna un Set con las fechas festivas del año dado en formato 'YYYY-MM-DD'.
 * Usa la fecha de celebración real (holiday), no la fecha de origen.
 * @param {number} year
 * @returns {Set<string>}
 */
function festivosDel(year) {
  if (_cacheFestivos[year]) return _cacheFestivos[year]
  const lista = getColombiaHolidays(year)
  const set = new Set(lista.map(f => f.holiday.replaceAll('/', '-')))
  _cacheFestivos[year] = set
  return set
}

/**
 * Construye la clave YYYY-MM-DD usando los getters locales de la fecha.
 * Evita el bug de toISOString() que devuelve la fecha en UTC (un día menos en UTC-5).
 * @param {Date} fecha
 * @returns {string}
 */
function toLocalKey(fecha) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Indica si una fecha es día no hábil.
 * No hábiles: sábados, domingos y festivos colombianos.
 * Solo cuentan lunes a viernes no festivos.
 * @param {Date} fecha
 * @returns {boolean}
 */
function esNoHabil(fecha) {
  const dia = fecha.getDay()
  if (dia === 0 || dia === 6) return true // domingo o sábado
  const key = toLocalKey(fecha)
  const year = fecha.getFullYear()
  // Cubrir festivos del año actual y del siguiente (fechas límite pueden cruzar año)
  return festivosDel(year).has(key) || festivosDel(year + 1).has(key)
}

/**
 * Avanza una fecha el número de días hábiles indicado.
 * Excluye sábados, domingos y festivos colombianos (Ley 1755/2015 y Dto. 2591/1991).
 * Solo cuentan lunes a viernes no festivos.
 * @param {Date} desde  Fecha de inicio (no se modifica)
 * @param {number} diasHabiles
 * @returns {Date}
 */
function sumarDiasHabiles(desde, diasHabiles) {
  const fecha = new Date(desde)
  fecha.setHours(0, 0, 0, 0)
  let contados = 0
  while (contados < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1)
    if (!esNoHabil(fecha)) contados++
  }
  return fecha
}

/**
 * Avanza la fecha hasta el siguiente día hábil si cae en no-hábil.
 * Guarda de seguridad para cuando colombia-holiday no detecta algún festivo móvil.
 * @param {Date} fecha
 * @returns {Date}
 */
function siguienteDiaHabil(fecha) {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  while (esNoHabil(d)) {
    d.setDate(d.getDate() + 1)
  }
  return d
}

// ─── Días hábiles límite por tipo (Colombia) ─────────────────────────────────
export const DIAS_HABILES_LIMITE = {
  tutela:    10,  // Decreto 2591/1991 (el juez puede fijar término distinto)
  peticion:  15,  // Ley 1755/2015
  queja:     15,  // Ley 1755/2015
  solicitud: 15,  // Ley 1755/2015
  reunion:   null,
  tarea:     null,
}

/**
 * Calcula la fecha límite contando días hábiles reales
 * (excluye sábados, domingos y festivos colombianos).
 *
 * @param {string}      tipo
 * @param {string|Date} fechaRecibido
 * @param {number}      [diasOverride]  Reemplaza el valor por defecto del tipo.
 *                                      Útil cuando el juez fija un término distinto en tutelas.
 * @returns {Date|null}
 */
export function calcularFechaLimite(tipo, fechaRecibido, diasOverride) {
  const dias = diasOverride ?? DIAS_HABILES_LIMITE[tipo]
  if (!dias || !fechaRecibido) return null
  const resultado = sumarDiasHabiles(new Date(fechaRecibido), dias)
  // Guardia: si el paquete colombia-holiday no detectó el festivo,
  // siguienteDiaHabil lo corrige avanzando al próximo día hábil real.
  return siguienteDiaHabil(resultado)
}

/**
 * Cuenta los días hábiles que quedan entre hoy y la fecha límite.
 * Retorna negativo si ya venció, 0 si vence hoy, null si no hay fecha.
 * @param {string|Date|null} fechaLimite
 * @returns {number|null}
 */
export function diasHabilesRestantes(fechaLimite) {
  if (!fechaLimite) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(fechaLimite)
  limite.setHours(0, 0, 0, 0)

  if (limite.getTime() === hoy.getTime()) return 0

  const signo = limite > hoy ? 1 : -1
  const [desde, hasta] = limite > hoy ? [hoy, limite] : [limite, hoy]
  let count = 0
  const cursor = new Date(desde)
  while (cursor < hasta) {
    cursor.setDate(cursor.getDate() + 1)
    if (!esNoHabil(cursor)) count++
  }
  return signo * count
}

// ─── Prioridad por tipo de solicitud ─────────────────────────────────────────

/**
 * Prioridad predeterminada según el tipo de tarea.
 * @param {string} tipo
 * @returns {'critica'|'alta'|'media'|'baja'}
 */
export function prioridadPorTipo(tipo) {
  if (tipo === 'tutela')                        return 'critica'
  if (tipo === 'peticion' || tipo === 'queja')  return 'alta'
  return 'media'
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

/**
 * Formatea una fecha en español colombiano: "26 jun. 2026"
 * @param {string|Date|null} fecha
 * @returns {string}
 */
export function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fecha))
}

/**
 * Días corridos restantes (para mostrar en UI junto a días hábiles).
 * @param {string|Date|null} fechaLimite
 * @returns {number|null}
 */
export function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(fechaLimite)
  limite.setHours(0, 0, 0, 0)
  return Math.round((limite - hoy) / (1000 * 60 * 60 * 24))
}

/**
 * Retorna true solo si la fecha límite es exactamente hoy (comparación de fecha local).
 * Úsalo para el label "Vence hoy" — NO uses diasHabilesRestantes() === 0,
 * que puede ser 0 para fechas futuras separadas solo por festivos/fines de semana.
 * @param {string|Date|null} fechaLimite
 * @returns {boolean}
 */
export function esHoy(fechaLimite) {
  if (!fechaLimite) return false
  const hoy = new Date()
  const limite = new Date(fechaLimite)
  return (
    limite.getFullYear() === hoy.getFullYear() &&
    limite.getMonth()    === hoy.getMonth()    &&
    limite.getDate()     === hoy.getDate()
  )
}

/**
 * Formatea una fecha en formato corto para labels de urgencia: "lun 29 jun"
 * @param {string|Date|null} fecha
 * @returns {string}
 */
export function formatDiaCorto(fecha) {
  if (!fecha) return ''
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(fecha))
}
