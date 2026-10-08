import { supabase } from '@/lib/supabase/client'

import type { Task, TaskInsert, TaskUpdate } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', id] as const,
}

/**
 * Acceso a datos de tasks. Único punto del feature que toca Supabase.
 * La seguridad la aplica RLS en PostgreSQL: cada usuario solo ve las
 * filas donde user_id = auth.uid().
 */
export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getTask(id: string): Promise<Task> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()

  if (error) throw error
  return data
}

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select().single()

  if (error) throw error
  return data
}

export async function updateTask(id: string, input: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) throw error
}
