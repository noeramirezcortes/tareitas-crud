import type { Database } from '@/lib/supabase/database.types'

export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrgRole = Database['public']['Enums']['org_role']
