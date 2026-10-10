import { supabase } from '@/lib/supabase/client'

import type { OrgRole } from '@/features/organizations/types'

import type { OrgMember } from './types'

export const memberKeys = {
  byOrg: (organizationId: string) => ['members', organizationId] as const,
}

export async function listMembers(organizationId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc('list_org_members', { p_org_id: organizationId })

  if (error) throw error
  return data
}

/**
 * Cambia el rol de un miembro. Si RLS deniega la operación, PostgREST
 * devuelve 0 filas sin error: se convierte en error explícito.
 */
export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  const { data, error } = await supabase
    .from('memberships')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .select('user_id')

  if (error) throw error
  if (data.length === 0) throw new Error('No tienes permiso para cambiar este rol')
}

export async function removeMember(organizationId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .select('user_id')

  if (error) throw error
  if (data.length === 0) throw new Error('No tienes permiso para expulsar a este miembro')
}
