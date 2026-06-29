import { cn } from '../../lib/cn'

const VARIANTS = {
  default: {
    card:  'bg-surface border-border',
    icon:  'bg-surface-3 text-text-secondary',
    value: 'text-text-primary',
    label: 'text-text-muted',
    sub:   'text-text-muted',
  },
  blue: {
    card:  'bg-blue-50 border-blue-100',
    icon:  'bg-blue-100 text-blue-600',
    value: 'text-blue-700',
    label: 'text-blue-600/80',
    sub:   'text-blue-500',
  },
  red: {
    card:  'bg-red-50 border-red-100',
    icon:  'bg-red-100 text-red-600',
    value: 'text-red-700',
    label: 'text-red-600/80',
    sub:   'text-red-500',
  },
  orange: {
    card:  'bg-orange-50 border-orange-100',
    icon:  'bg-orange-100 text-orange-500',
    value: 'text-orange-700',
    label: 'text-orange-600/80',
    sub:   'text-orange-500',
  },
  green: {
    card:  'bg-primary-light border-primary/20',
    icon:  'bg-primary/15 text-primary',
    value: 'text-primary',
    label: 'text-primary/70',
    sub:   'text-primary/60',
  },
}

/**
 * @param {{
 *   label: string,
 *   value: number|string,
 *   sub?: string,
 *   icon: React.ComponentType<{className?: string}>,
 *   color?: 'default'|'blue'|'red'|'orange'|'green'
 * }} props
 */
export default function StatCard({ label, value, sub, icon: Icon, color = 'default' }) {
  const v = VARIANTS[color] ?? VARIANTS.default

  return (
    <div className={cn('rounded-xl border p-4 sm:p-5 flex items-start gap-4 shadow-sm', v.card)}>
      {/* Ícono */}
      {Icon && (
        <div className={cn('rounded-lg p-2.5 shrink-0', v.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      )}

      {/* Texto */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-medium uppercase tracking-wide leading-none mb-1.5', v.label)}>
          {label}
        </p>
        <p className={cn('text-3xl font-bold leading-none', v.value)}>{value}</p>
        {sub && <p className={cn('text-xs mt-1.5', v.sub)}>{sub}</p>}
      </div>
    </div>
  )
}
