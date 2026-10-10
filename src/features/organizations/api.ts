import { supabase } from '@/lib/supabase/client'

import type { Organization } from './types'

export const organizationKeys = {
  all: ['organizations'] as const,
}

/** Organizaciones visibles para el usuario (RLS filtra por membresía). */
export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * Crea la organización, la membresía owner y el workspace "General"
 * en una sola llamada atómica (función SQL create_organization).
 * Devuelve el id de la nueva organización.
 */
export async function createOrganization(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_organization', { p_name: name })

  if (error) throw error
  return data
}
