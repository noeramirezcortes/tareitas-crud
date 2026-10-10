import type { OrgRole } from '@/features/organizations/types'

/** Miembro de una organización con su email (vía RPC list_org_members). */
export interface OrgMember {
  user_id: string
  email: string
  role: OrgRole
  created_at: string
}
