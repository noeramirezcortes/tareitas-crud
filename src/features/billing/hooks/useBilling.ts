import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useWorkspace } from '@/features/workspaces/useWorkspace'

import { billingKeys, createCheckoutSession, createPortalSession, getBillingStatus, listPlans } from '../api'

export function useBillingStatus(
  organizationId: string | null,
  options: { refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: organizationId ? billingKeys.status(organizationId) : ['billing', 'status', 'none'],
    queryFn: () => getBillingStatus(organizationId as string),
    enabled: organizationId !== null,
    refetchInterval: options.refetchInterval ?? false,
  })
}

/** Billing de la organización activa. */
export function useCurrentBilling() {
  const { currentOrganization } = useWorkspace()
  return useBillingStatus(currentOrganization?.id ?? null)
}

/**
 * ¿La organización activa tiene la función premium? undefined mientras
 * carga: la UI no debe bloquear nada hasta saberlo (el servidor decide).
 */
export function usePlanFeature(feature: string): boolean | undefined {
  const { data } = useCurrentBilling()
  return data ? data.plan.features[feature] === true : undefined
}

export function usePlans() {
  return useQuery({ queryKey: billingKeys.plans, queryFn: listPlans, staleTime: 5 * 60_000 })
}

function redirectTo(url: string) {
  window.location.assign(url)
}

export function useStartCheckout(organizationId: string) {
  return useMutation({
    mutationFn: (planCode: string) => createCheckoutSession(organizationId, planCode),
    onSuccess: redirectTo,
    onError: (error) => toast.error(error.message),
  })
}

export function useOpenPortal(organizationId: string) {
  return useMutation({
    mutationFn: () => createPortalSession(organizationId),
    onSuccess: redirectTo,
    onError: (error) => toast.error(error.message),
  })
}
