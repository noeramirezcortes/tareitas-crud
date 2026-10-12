import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase/client'

import type { BillingStatus, Plan } from './types'

export const billingKeys = {
  all: ['billing'] as const,
  status: (organizationId: string) => ['billing', 'status', organizationId] as const,
  plans: ['billing', 'plans'] as const,
}

/** Plan, límites, consumo y suscripción de la organización (RPC get_billing_status). */
export async function getBillingStatus(organizationId: string): Promise<BillingStatus> {
  const { data, error } = await supabase.rpc('get_billing_status', { p_org: organizationId })

  if (error) throw error
  return data as unknown as BillingStatus
}

/** Catálogo público de planes, para compararlos. */
export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_public', true)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Las operaciones con Stripe se hacen en Edge Functions (servidor): el
 * navegador nunca ve claves secretas ni decide qué plan tiene nadie.
 * Devuelven { url } a la que se redirige al usuario.
 */
async function invokeBilling(fn: 'billing-checkout' | 'billing-portal', body: object): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; error?: string }>(fn, { body })

  if (error) {
    // Las respuestas no-2xx llegan como FunctionsHttpError: el motivo va en el cuerpo.
    if (error instanceof FunctionsHttpError) {
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'No se pudo conectar con el servicio de pagos')
    }
    throw new Error('No se pudo conectar con el servicio de pagos')
  }
  if (!data?.url) throw new Error('El servicio de pagos no devolvió una dirección válida')
  return data.url
}

/** Abre Stripe Checkout para suscribir la organización al plan indicado. */
export function createCheckoutSession(organizationId: string, planCode: string): Promise<string> {
  return invokeBilling('billing-checkout', { organization_id: organizationId, plan_code: planCode })
}

/** Abre el Customer Portal de Stripe (método de pago, facturas, cancelar). */
export function createPortalSession(organizationId: string): Promise<string> {
  return invokeBilling('billing-portal', { organization_id: organizationId })
}
