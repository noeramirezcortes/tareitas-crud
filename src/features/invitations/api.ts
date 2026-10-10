import { supabase } from '@/lib/supabase/client'

import type { OrgRole } from '@/features/organizations/types'

import type { Invitation } from './types'

export const invitationKeys = {
  byOrg: (organizationId: string) => ['invitations', organizationId] as const,
}

/** Solo owners y admins ven las invitaciones (RLS). */
export async function listInvitations(organizationId: string): Promise<Invitation[]> {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export interface CreateInvitationInput {
  email: string
  organizationId: string
  role: OrgRole
  invitedBy: string
}

export async function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email: input.email.trim().toLowerCase(),
      organization_id: input.organizationId,
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cancelInvitation(id: string): Promise<void> {
  const { data, error } = await supabase.from('invitations').delete().eq('id', id).select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('No tienes permiso para cancelar esta invitación')
}

/**
 * Acepta una invitación por token. La función SQL valida vigencia, uso
 * único y que el email de la cuenta coincida. Devuelve el id de la org.
 */
export async function acceptInvitation(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (error) throw error
  return data
}

/** Enlace que el admin copia y comparte. No hay envío de correo todavía. */
export function invitationLink(token: string): string {
  return `${window.location.origin}/invite/${token}`
}
