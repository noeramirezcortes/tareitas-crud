import { supabase } from '@/lib/supabase/client'

export const tagKeys = {
  all: ['tags'] as const,
  byWorkspace: (wsId: string) => ['tags', 'workspace', wsId] as const,
}

export async function listTags(workspaceId: string): Promise<import('@/features/tags/types').Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name')

  if (error) throw error
  return data
}

export async function createTag(input: import('@/features/tags/types').TagInsert): Promise<import('@/features/tags/types').Tag> {
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