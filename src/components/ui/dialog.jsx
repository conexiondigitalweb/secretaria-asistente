import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export const Dialog        = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose   = DialogPrimitive.Close
export const DialogPortal  = DialogPrimitive.Portal

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  )
}

export function DialogContent({ className, children, showClose = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
          'bg-surface rounded-xl border border-border shadow-xl',
          'max-h-[90vh] overflow-y-auto',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
          'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
          className
        )}
        {...props}
      >
        {showClose && (
          <DialogClose className="absolute right-4 top-4 rounded-md p-1 text-text-muted
                                  hover:text-text-primary hover:bg-surface-3 transition-colors
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <X className="h-4 w-4" />
          </DialogClose>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1 px-5 pt-5 pb-4 border-b border-border', className)} {...props} />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-sm font-semibold text-text-primary', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-xs text-text-muted', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}
