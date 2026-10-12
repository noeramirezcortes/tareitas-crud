import { cn } from '@/lib/utils'

interface UsageMeterProps {
  label: string
  used: number
  /** null = ilimitado */
  limit: number | null
  /** Texto auxiliar bajo la barra (p. ej. invitaciones pendientes). */
  hint?: string
}

/** Barra de consumo vs. límite del plan. */
export function UsageMeter({ label, used, limit, hint }: UsageMeterProps) {
  const unlimited = limit === null
  const pct = unlimited ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))
  const atLimit = !unlimited && used >= limit
  const nearLimit = !unlimited && !atLimit && pct >= 80

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className={cn('tabular-nums text-muted-foreground', atLimit && 'font-medium text-destructive')}>
          {unlimited ? `${used} · ilimitado` : `${used} de ${limit}`}
        </span>
      </div>

      {unlimited ? (
        <div className="h-2 rounded-full bg-secondary" aria-hidden="true" />
      ) : (
        <div
          role="progressbar"
          aria-label={`${label}: ${used} de ${limit}`}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          className="h-2 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn(
              'h-full rounded-full transition-all',
              atLimit ? 'bg-destructive' : nearLimit ? 'bg-amber-500' : 'bg-primary',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
