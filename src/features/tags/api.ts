import { supabase } from '@/lib/supabase/client'

import type { Tag, TagInsert } from './types'

export const tagKeys = {
  all: ['tags'] as const,
}

/**
 * Acceso a datos de tags y del vínculo task_tags (M2M).
 * RLS en PostgreSQL limita cada fila a su propietario.
 */
export async function listTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('*').order('name')

  if (error) throw error
  return data
}

export async function createTag(input: TagInsert): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ ...input, name: input.name.trim() })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)

  if (error) throw error
}

/**
 * Sincroniza las etiquetas de una tarea: borra los vínculos actuales
 * e inserta los nuevos (task_tags es PK compuesta, no se actualiza).
 */
export async function setTaskTags(taskId: string, tagIds: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('task_tags')
    .delete()
    .eq('task_id', taskId)

  if (deleteError) throw deleteError

  if (tagIds.length === 0) return

  const { error: insertError } = await supabase
    .from('task_tags')
    .insert(tagIds.map((tagId) => ({ task_id: taskId, tag_id: tagId })))

  if (insertError) throw insertError
}
