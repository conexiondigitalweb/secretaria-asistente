import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors ' +
  'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary-hover',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover',
        outline:     'border border-border bg-surface text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        secondary:   'bg-surface-3 text-text-primary hover:bg-border',
        ghost:       'text-text-secondary hover:bg-surface-3 hover:text-text-primary',
        link:        'text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'px-4 py-2',
        sm:      'px-3 py-1.5 text-xs rounded-md',
        lg:      'px-6 py-2.5 text-base',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
)

/**
 * shadcn/ui-style Button.
 * @param {{ variant?: string, size?: string, asChild?: boolean } & React.ButtonHTMLAttributes} props
 */
export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
