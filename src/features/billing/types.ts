import type { Database } from '@/lib/supabase/database.types'

export type Plan = Database['public']['Tables']['plans']['Row']
export type SubscriptionStatus = Database['public']['Tables']['subscriptions']['Row']['status']

/** Recursos con límite numérico por plan. */
export type LimitedResource = 'workspaces' | 'projects' | 'members'

/** Respuesta de la función SQL get_billing_status(org). */
export interface BillingStatus {
  plan: {
    code: string
    name: string
    description: string | null
    features: Record<string, boolean>
  }
  /** null = ilimitado */
  limits: Record<LimitedResource, number | null>
  usage: Record<LimitedResource, number> & { pending_invitations: number }
  subscription: {
    status: SubscriptionStatus
    plan_code: string
    current_period_end: string | null
    cancel_at_period_end: boolean
    past_due_since: string | null
    grace_ends_at: string | null
  } | null
  /** Solo un owner puede iniciar el pago o administrar la suscripción. */
  can_manage: boolean
}
