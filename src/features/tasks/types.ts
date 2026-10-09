import type { Database } from '@/lib/supabase/database.types'

import type { Tag } from '@/features/tags/types'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']

export type TaskPriority = Task['priority']
export type TaskStatus = Task['status']

export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high']
export const TASK_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'done']

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  done: 'Completada',
}

/** Tarea con sus relaciones aplanadas (proyecto + etiquetas). */
export interface TaskWithRelations extends Task {
  project: { id: string; name: string } | null
  tags: Tag[]
}

/** Filtros de la lista de tareas. Se aplican en servidor (PostgREST). */
export interface TaskFilters {
  text?: string
  /** uuid de proyecto, o 'none' para tareas sin proyecto. */
  projectId?: string
  priority?: TaskPriority
  status?: TaskStatus
  due?: 'overdue' | 'today' | 'week'
  tagId?: string
}
