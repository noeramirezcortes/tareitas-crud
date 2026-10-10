import { supabase } from '@/lib/supabase/client'

import type { Workspace, WorkspaceInsert } from './types'

export const workspaceKeys = {
  all: ['workspaces'] as const,
}

/** Workspaces visibles para el usuario en todas sus organizaciones (RLS). */
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function createWorkspace(input: WorkspaceInsert): Promise<Workspace> {
  const { data, error } = await supabase.from('workspaces').insert(input).select().single()

  if (error) throw error
  return data
}
