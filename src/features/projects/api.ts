import { supabase } from '@/lib/supabase/client'

import type { Project, ProjectInsert, ProjectUpdate, ProjectWithTaskCount } from './types'

export const projectKeys = {
  all: ['projects'] as const,
  byWorkspace: (wsId: string) => ['projects', 'workspace', wsId] as const,
}

export async function listProjects(workspaceId: string): Promise<ProjectWithTaskCount[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(count)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map(({ tasks, ...project }) => ({
    ...project,
    taskCount: tasks[0]?.count ?? 0,
  }))
}

export async function createProject(input: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(input).select().single()

  if (error) throw error
  return data
}

export async function updateProject(id: string, input: ProjectUpdate): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)

  if (error) throw error
}