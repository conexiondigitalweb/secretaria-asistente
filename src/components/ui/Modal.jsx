import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
} from './dialog'
import { cn } from '../../lib/cn'

/**
 * Modal wrapper sobre shadcn/ui Dialog.
 * Mantiene la misma API pública para no romper ningún componente existente.
 *
 * @param {{ open: boolean, onClose: () => void, title: string, children: React.ReactNode, width?: string }} props
 */
export default function Modal({ open, onClose, title, children, width = 'max-w-xl' }) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className={cn('w-full', width)} showClose={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title}</DialogTitle>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-muted hover:text-text-primary
                         hover:bg-surface-3 transition-colors text-lg leading-none"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
      </DialogContent>
    </Dialog>
  )
}
