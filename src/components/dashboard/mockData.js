// Datos de ejemplo para desarrollo — reemplazar por hooks Supabase al conectar las keys
const hoy = new Date()
const d = (offsetDays) => {
  const f = new Date(hoy)
  f.setDate(f.getDate() + offsetDays)
  return f.toISOString()
}

export const MOCK_TAREAS = [
  {
    id: '1',
    tipo: 'tutela',
    asunto: 'Tutela radicada — acceso a puesto docente IE Simón Bolívar',
    remitente: 'Juzgado 1 Civil Municipal',
    fecha_recibido: d(-8),
    fecha_limite: d(2),
    estado: 'en_proceso',
    prioridad: 'critica',
  },
  {
    id: '2',
    tipo: 'peticion',
    asunto: 'Derecho de petición — traslado docente vereda El Retiro',
    remitente: 'María Elena Torres',
    fecha_recibido: d(-12),
    fecha_limite: d(3),
    estado: 'pendiente',
    prioridad: 'alta',
  },
  {
    id: '3',
    tipo: 'queja',
    asunto: 'Queja por irregularidades en matrícula IE La Presentación',
    remitente: 'Asociación de Padres',
    fecha_recibido: d(-5),
    fecha_limite: d(10),
    estado: 'pendiente',
    prioridad: 'media',
  },
  {
    id: '4',
    tipo: 'tarea',
    asunto: 'Informe de cobertura escolar — corte junio 2026',
    remitente: 'Secretario Sanjuán',
    fecha_recibido: d(-2),
    fecha_limite: d(5),
    estado: 'pendiente',
    prioridad: 'alta',
  },
  {
    id: '5',
    tipo: 'solicitud',
    asunto: 'Solicitud de dotación de textos escolares — Zona Rural Norte',
    remitente: 'Rector IE Rural Norte',
    fecha_recibido: d(-1),
    fecha_limite: d(14),
    estado: 'pendiente',
    prioridad: 'baja',
  },
]

export const MOCK_EVENTOS = [
  {
    id: 'e1',
    titulo: 'Reunión Consejo Municipal de Política Social',
    tipo: 'reunion',
    fecha_inicio: (() => { const f = new Date(hoy); f.setHours(9, 0, 0, 0); return f.toISOString() })(),
    lugar: 'Alcaldía Municipal — Sala de Juntas',
  },
  {
    id: 'e2',
    titulo: 'Entrega informe MEN — Plan de Mejoramiento',
    tipo: 'compromiso',
    fecha_inicio: (() => { const f = new Date(hoy); f.setHours(14, 30, 0, 0); return f.toISOString() })(),
    lugar: 'Virtual — Meet',
  },
  {
    id: 'e3',
    titulo: 'Visita IE Nuestra Señora de Fátima',
    tipo: 'evento',
    fecha_inicio: (() => { const f = new Date(hoy); f.setDate(f.getDate() + 1); f.setHours(8, 0, 0, 0); return f.toISOString() })(),
    lugar: 'Institución Educativa',
  },
]
