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

// ─── Días hábiles límite por tipo (Colombia) ─────────────────────────────────
const DIAS_HABILES_LIMITE = {
  tutela:   10,  // Decreto 2591/1991 — días hábiles, improrrogable
  peticion: 15,  // Ley 1755/2015 — días hábiles
  queja:    15,  // Ley 1755/2015
  solicitud: 15, // Ley 1755/2015
  reunion:  null,
  tarea:    null,
}

/**
 * Calcula la fecha límite de respuesta según el tipo de solicitud,
 * contando días hábiles reales (excluye domingos y festivos colombianos).
 * @param {string} tipo
 * @param {string|Date} fechaRecibido
 * @returns {Date|null}
 */
export function calcularFechaLimite(tipo, fechaRecibido) {
  const dias = DIAS_HABILES_LIMITE[tipo]
  if (!dias || !fechaRecibido) return null
  return sumarDiasHabiles(new Date(fechaRecibido), dias)
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
