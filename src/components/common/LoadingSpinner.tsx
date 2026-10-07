import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  label?: string
}

export function LoadingSpinner({ className, label = 'Cargando…' }: LoadingSpinnerProps) {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 p-8 text-muted-foreground', className)}
      role="status"
    >
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  )
}
