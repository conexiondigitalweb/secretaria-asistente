// Días límite por tipo de solicitud (Colombia)
const DIAS_LIMITE = {
  tutela: 10,    // Decreto 2591/1991 — improrrogable
  peticion: 15,  // Ley 1755/2015
  queja: 15,
  solicitud: 15,
  reunion: null,
  tarea: null,
}

export function calcularFechaLimite(tipo, fechaRecibido) {
  const dias = DIAS_LIMITE[tipo]
  if (!dias) return null
  const fecha = new Date(fechaRecibido)
  fecha.setDate(fecha.getDate() + dias)
  return fecha
}

export function formatFecha(fecha) {
  if (!fecha) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(fecha))
}

export function diasRestantes(fechaLimite) {
  if (!fechaLimite) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(fechaLimite)
  limite.setHours(0, 0, 0, 0)
  return Math.round((limite - hoy) / (1000 * 60 * 60 * 24))
}
