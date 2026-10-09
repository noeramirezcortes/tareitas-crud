import { supabase } from '@/lib/supabase/client'

import type { Project, ProjectInsert, ProjectUpdate, ProjectWithTaskCount } from './types'

export const projectKeys = {
  all: ['projects'] as const,
}

/**
 * Acceso a datos de projects. Único punto del feature que toca Supabase.
 * RLS en PostgreSQL limita cada fila a su propietario.
 */
export async function listProjects(): Promise<ProjectWithTaskCount[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, tasks(count)')
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
