import { cn } from '../../lib/cn'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-surface shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1.5 p-5 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-sm font-semibold text-text-primary', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-xs text-text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn('flex items-center px-5 py-3 border-t border-border', className)}
      {...props}
    />
  )
}
