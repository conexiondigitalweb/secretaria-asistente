/**
 * @param {{ label: string, value: number|string, sub?: string, color?: 'default'|'red'|'yellow'|'green'|'blue' }} props
 */
export default function StatCard({ label, value, sub, color = 'default' }) {
  const colors = {
    default: 'bg-white border-slate-200 text-slate-800',
    red:     'bg-red-50 border-red-200 text-red-700',
    yellow:  'bg-yellow-50 border-yellow-200 text-yellow-700',
    green:   'bg-green-50 border-green-200 text-green-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
  }

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-1 ${colors[color]}`}>
      <span className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</span>
      <span className="text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  )
}
