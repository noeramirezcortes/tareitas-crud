import { supabase } from '@/lib/supabase/client'
import { setTaskTags } from '@/features/tags/api'
import type { Tag } from '@/features/tags/types'
import { isoDateInDays, todayISODate } from '@/utils/dates'

import type { Task, TaskFilters, TaskInsert, TaskUpdate, TaskWithRelations } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters = {}) => [...taskKeys.all, 'list', filters] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
}

const TASK_SELECT = '*, project:projects(id,name), task_tags(tag:tags(id,name))'
// Cuando se filtra por etiqueta hace falta un join !inner adicional (alias)
// sin perder el join completo de etiquetas para mostrar.
const TASK_SELECT_WITH_TAG_FILTER =
  '*, project:projects(id,name), task_tags(tag:tags(id,name)), tag_filter:task_tags!inner(tag_id)'

type TaskRow = Task & {
  project: { id: string; name: string } | null
  task_tags: { tag: Tag | null }[] | null
  tag_filter?: { tag_id: string }[] | null
}

function flatten(row: TaskRow): TaskWithRelations {
  const { project, task_tags, tag_filter: _ignored, ...task } = row
  return {
    ...task,
    project: project ?? null,
    tags: (task_tags ?? []).map((link) => link.tag).filter((tag): tag is Tag => tag != null),
  }
}

/**
 * Acceso a datos de tasks. Único punto del feature que toca Supabase.
 * RLS en PostgreSQL limita cada fila a su propietario.
 * Los filtros se aplican en servidor (ver TaskFilters).
 */
export async function listTasks(filters: TaskFilters = {}): Promise<TaskWithRelations[]> {
  let query = supabase
    .from('tasks')
    .select(filters.tagId ? TASK_SELECT_WITH_TAG_FILTER : TASK_SELECT)
    .order('created_at', { ascending: false })

  if (filters.text) {
    // Sanitizar caracteres con significado en la sintaxis or() de PostgREST
    const escaped = filters.text.replace(/[%(),.\\]/g, ' ').trim()
    if (escaped) {
      query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`)
    }
  }
  if (filters.projectId === 'none') {
    query = query.is('project_id', null)
  } else if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.due === 'overdue') {
    // due_date < hoy (los NULL quedan excluidos por la comparación)
    query = query.lt('due_date', todayISODate())
  } else if (filters.due === 'today') {
    query = query.eq('due_date', todayISODate())
  } else if (filters.due === 'week') {
    query = query.gte('due_date', todayISODate()).lte('due_date', isoDateInDays(7))
  }
  if (filters.tagId) {
    query = query.eq('tag_filter.tag_id', filters.tagId)
  }

  const { data, error } = await query

  if (error) throw error
  return (data as unknown as TaskRow[]).map(flatten)
}

export async function getTask(id: string): Promise<TaskWithRelations> {
  const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('id', id).single()

  if (error) throw error
  return flatten(data as unknown as TaskRow)
}

export async function createTask(input: TaskInsert, tagIds: string[] = []): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select().single()

  if (error) throw error

  if (tagIds.length > 0) {
    await setTaskTags(data.id, tagIds)
  }
  return data
}

export async function updateTask(
  id: string,
  input: TaskUpdate,
  tagIds?: string[],
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (tagIds) {
    await setTaskTags(id, tagIds)
  }
  return data
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)

  if (error) throw error
}
