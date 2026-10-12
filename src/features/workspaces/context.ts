import { createContext } from 'react'

import type { Organization } from '@/features/organizations/types'

import type { Workspace } from './types'

export interface WorkspaceContextValue {
  organizations: Organization[]
  workspaces: Workspace[]
  currentOrganization: Organization | null
  currentWorkspace: Workspace | null
  /** Workspaces de la organización actual. */
  orgWorkspaces: Workspace[]
  isLoading: boolean
  selectOrganization: (organizationId: string) => void
  selectWorkspace: (workspace: Pick<Workspace, 'id' | 'organization_id'>) => void
  /** Vuelve a leer organizaciones y workspaces desde el servidor. */
  refresh: () => Promise<void>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
