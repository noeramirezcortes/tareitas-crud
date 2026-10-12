import { Check, Minus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UsageMeter } from '@/features/billing/components/UsageMeter'
import { useBillingStatus, useOpenPortal, usePlans, useStartCheckout } from '@/features/billing/hooks/useBilling'
import { FEATURE_LABELS, RESOURCE_LABELS } from '@/features/billing/limits'
import type { BillingStatus, LimitedResource, Plan, SubscriptionStatus } from '@/features/billing/types'
import { useWorkspace } from '@/features/workspaces/useWorkspace'

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Activa',
  trialing: 'En periodo de prueba',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
  unpaid: 'Impaga',
  incomplete: 'Incompleta',
  incomplete_expired: 'Expirada',
  paused: 'En pausa',
}

const RESOURCES: LimitedResource[] = ['workspaces', 'projects', 'members']

/** Tras volver de Stripe, el webhook puede tardar unos segundos en llegar. */
const CONFIRMATION_TIMEOUT_MS = 30_000

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(iso))
}

function limitText(value: number | null, noun: string): string {
  return value === null ? `${noun} ilimitados` : `${value} ${noun.toLowerCase()}`
}

export function BillingPage() {
  const { currentOrganization, isLoading: workspaceLoading } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')
  const organizationId = currentOrganization?.id ?? null

  // Al volver de un pago exitoso se consulta cada 2 s hasta que el webhook
  // actualice el plan (Stripe es la fuente de verdad, no la redirección).
  const awaitingPayment = checkoutResult === 'success'
  const [timedOut, setTimedOut] = useState(false)
  const { data: status, isLoading, isError, refetch } = useBillingStatus(organizationId, {
    refetchInterval: awaitingPayment && !timedOut ? 2000 : false,
  })
  const confirming = awaitingPayment && !timedOut && status?.plan.code === 'free'
  const plans = usePlans()
  const startCheckout = useStartCheckout(organizationId ?? '')
  const openPortal = useOpenPortal(organizationId ?? '')

  const clearCheckoutParam = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('checkout')
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  useEffect(() => {
    if (checkoutResult !== 'cancel') return
    toast.info('Pago cancelado. No se te ha cobrado nada.')
    clearCheckoutParam()
  }, [checkoutResult, clearCheckoutParam])

  useEffect(() => {
    if (!awaitingPayment || !status || status.plan.code === 'free') return
    toast.success(`¡Plan ${status.plan.name} activado!`)
    clearCheckoutParam()
  }, [awaitingPayment, status, clearCheckoutParam])

  useEffect(() => {
    if (!awaitingPayment) return
    const timer = window.setTimeout(() => {
      setTimedOut(true)
      clearCheckoutParam()
      toast.info('Estamos confirmando tu pago con Stripe. Recarga esta página en unos segundos.')
    }, CONFIRMATION_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [awaitingPayment, clearCheckoutParam])

  if (workspaceLoading || (organizationId !== null && isLoading)) return <LoadingSpinner />
  if (!currentOrganization) {
    return (
      <EmptyState
        title="No perteneces a ninguna organización"
        description="Crea una desde el selector del encabezado."
      />
    )
  }
  if (isError || !status) {
    return <ErrorState description="No se pudo cargar el plan de la organización." onRetry={() => refetch()} />
  }

  const subscription = status.subscription
  const isFree = status.plan.code === 'free'
  const hasStripeCustomer = subscription !== null
  const purchasablePlans = (plans.data ?? []).filter(
    (plan) => plan.stripe_price_id !== null && plan.code !== status.plan.code && isFree,
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Plan y facturación</h1>
        <p className="text-sm text-muted-foreground">{currentOrganization.name}</p>
      </div>

      {confirming && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          Confirmando tu pago con Stripe… esto toma solo unos segundos.
        </p>
      )}

      <SubscriptionNotices status={status} />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Plan {status.plan.name}</span>
              {subscription && (
                <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                  {STATUS_LABELS[subscription.status]}
                </Badge>
              )}
            </CardTitle>
            {status.plan.description && <CardDescription>{status.plan.description}</CardDescription>}
          </div>

          <div className="flex flex-wrap gap-2">
            {status.can_manage && hasStripeCustomer && (
              <Button
                variant="outline"
                onClick={() => openPortal.mutate()}
                disabled={openPortal.isPending}
              >
                {openPortal.isPending ? 'Abriendo…' : 'Administrar suscripción'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {subscription?.current_period_end && subscription.status === 'active' && (
            <p>
              {subscription.cancel_at_period_end
                ? `Tu suscripción termina el ${formatDate(subscription.current_period_end)}.`
                : `Se renueva el ${formatDate(subscription.current_period_end)}.`}
            </p>
          )}
          {!status.can_manage && (
            <p>Solo un owner de la organización puede cambiar el plan o administrar la suscripción.</p>
          )}
          {isFree && !subscription && <p>Estás en el plan gratuito. Actualiza para quitar los límites.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumo</CardTitle>
          <CardDescription>Lo que usa tu organización frente a los límites de su plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {RESOURCES.map((resource) => (
            <UsageMeter
              key={resource}
              label={RESOURCE_LABELS[resource]}
              used={status.usage[resource]}
              limit={status.limits[resource]}
              hint={
                resource === 'members' && status.usage.pending_invitations > 0
                  ? `${status.usage.pending_invitations} ${
                      status.usage.pending_invitations === 1 ? 'invitación pendiente reserva' : 'invitaciones pendientes reservan'
                    } un puesto.`
                  : resource === 'projects'
                    ? 'El proyecto General no cuenta.'
                    : undefined
              }
            />
          ))}
        </CardContent>
      </Card>

      {plans.data && plans.data.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Planes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.data.map((plan) => (
              <PlanCard
                key={plan.code}
                plan={plan}
                isCurrent={plan.code === status.plan.code}
                action={
                  purchasablePlans.some((p) => p.code === plan.code) ? (
                    status.can_manage ? (
                      <Button
                        className="w-full"
                        onClick={() => startCheckout.mutate(plan.code)}
                        disabled={startCheckout.isPending}
                      >
                        {startCheckout.isPending ? 'Redirigiendo a Stripe…' : `Actualizar a ${plan.name}`}
                      </Button>
                    ) : (
                      <p className="text-center text-xs text-muted-foreground">
                        Pídele a un owner que actualice el plan.
                      </p>
                    )
                  ) : null
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SubscriptionNotices({ status }: { status: BillingStatus }) {
  const sub = status.subscription
  if (!sub) return null

  if (sub.status === 'past_due') {
    const stillPro = status.plan.code !== 'free'
    return (
      <p role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
        {stillPro
          ? `No pudimos cobrar tu última factura. Conservas el plan ${status.plan.name} hasta el ${formatDate(sub.grace_ends_at)}; actualiza tu método de pago para no perderlo.`
          : 'No pudimos cobrar tu última factura y el periodo de gracia terminó: la organización volvió al plan gratuito.'}
      </p>
    )
  }
  if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
    return (
      <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
        Tu suscripción anterior terminó. Lo que ya creaste se conserva, pero no se puede crear más por
        encima de los límites del plan gratuito.
      </p>
    )
  }
  return null
}

function PlanCard({ plan, isCurrent, action }: { plan: Plan; isCurrent: boolean; action: React.ReactNode }) {
  const featureKeys = Object.keys(FEATURE_LABELS)

  return (
    <Card className={isCurrent ? 'border-primary' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {plan.name}
          {isCurrent && <Badge>Plan actual</Badge>}
        </CardTitle>
        {plan.description && <CardDescription>{plan.description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1.5 text-sm">
          <li>{limitText(plan.max_workspaces, 'Workspaces')}</li>
          <li>{limitText(plan.max_projects, 'Proyectos')}</li>
          <li>{limitText(plan.max_members, 'Miembros')}</li>
          {featureKeys.map((key) => {
            const enabled = plan.features[key] === true
            return (
              <li key={key} className="flex items-center gap-2">
                {enabled ? (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                ) : (
                  <Minus className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={enabled ? undefined : 'text-muted-foreground'}>{FEATURE_LABELS[key]}</span>
              </li>
            )
          })}
        </ul>
        {action}
      </CardContent>
    </Card>
  )
}
