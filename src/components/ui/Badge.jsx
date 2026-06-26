const VARIANTS = {
  critica:    'bg-red-100 text-red-700 border-red-200',
  alta:       'bg-orange-100 text-orange-700 border-orange-200',
  media:      'bg-yellow-100 text-yellow-700 border-yellow-200',
  baja:       'bg-slate-100 text-slate-600 border-slate-200',
  pendiente:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  en_proceso: 'bg-blue-50 text-blue-700 border-blue-200',
  resuelto:   'bg-green-50 text-green-700 border-green-200',
  vencido:    'bg-red-50 text-red-700 border-red-200',
}

const LABELS = {
  critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja',
  pendiente: 'Pendiente', en_proceso: 'En proceso', resuelto: 'Resuelto', vencido: 'Vencido',
  tutela: 'Tutela', peticion: 'Petición', queja: 'Queja', solicitud: 'Solicitud',
  reunion: 'Reunión', tarea: 'Tarea', otro: 'Otro',
  correo: 'Correo', fisico: 'Físico', verbal: 'Verbal', whatsapp: 'WhatsApp',
}

/**
 * @param {{ value: string, className?: string }} props
 */
export default function Badge({ value, className = '' }) {
  const style = VARIANTS[value] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const label = LABELS[value] ?? value
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style} ${className}`}>
      {label}
    </span>
  )
}
