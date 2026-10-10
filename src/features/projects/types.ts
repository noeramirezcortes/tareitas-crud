import type { Database } from '@/lib/supabase/database.types'

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export interface ProjectWithTaskCount extends Project {
  taskCount: number
}