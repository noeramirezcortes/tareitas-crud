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

export async function deleteWorkspace(id: string): Promise<void> {
  const { data, error } = await supabase.from('workspaces').delete().eq('id', id).select('id')

  if (error) throw error
  if (data.length === 0) throw new Error('No tienes permiso para eliminar este workspace')
}

/** Contenido que se perdería al borrar un workspace (para el aviso de confirmación). */
export async function countWorkspaceContents(
  workspaceId: string,
): Promise<{ projects: number; tags: number; tasks: number }> {
  const [projects, tags] = await Promise.all([
    supabase.from('projects').select('id, tasks(count)').eq('workspace_id', workspaceId),
    supabase.from('tags').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId),
  ])

  if (projects.error) throw projects.error
  if (tags.error) throw tags.error

  const tasks = projects.data.reduce((total, p) => total + (p.tasks[0]?.count ?? 0), 0)
  return { projects: projects.data.length, tags: tags.count ?? 0, tasks }
}
