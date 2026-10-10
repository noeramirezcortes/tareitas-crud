import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

import { useSession } from '@/features/auth/hooks/useSession'
import { listOrganizations, organizationKeys } from '@/features/organizations/api'
import type { Organization } from '@/features/organizations/types'

import { listWorkspaces, workspaceKeys } from './api'
import type { Workspace } from './types'

const STORAGE_KEY = 'tareitas_scope'

interface Scope {
  organizationId: string | null
  workspaceId: string | null
}

function readScope(): Scope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Scope
  } catch {
    // Dato corrupto o storage no disponible: se usa el valor por defecto.
  }
  return { organizationId: null, workspaceId: null }
}

function writeScope(scope: Scope) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scope))
  } catch {
    // Sin storage la selección sólo dura la sesión de la pestaña.
  }
}

interface WorkspaceContextValue {
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

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/**
 * Ámbito activo del usuario: organización y workspace.
 * Los datos vienen de TanStack Query; sólo la selección vive aquí y se
 * guarda por id, así no hay closures obsoletos ni listas copiadas.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useSession()
  const queryClient = useQueryClient()
  const [scope, setScope] = useState<Scope>(readScope)

  const orgsQuery = useQuery({
    queryKey: organizationKeys.all,
    queryFn: listOrganizations,
    enabled: isAuthenticated,
  })
  const wsQuery = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: listWorkspaces,
    enabled: isAuthenticated,
  })

  const organizations = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data])
  const workspaces = useMemo(() => wsQuery.data ?? [], [wsQuery.data])

  // Si el id guardado ya no existe (org eliminada, pérdida de acceso),
  // se usa la primera disponible en lugar de quedar en un estado vacío.
  const currentOrganization =
    organizations.find((org) => org.id === scope.organizationId) ?? organizations[0] ?? null
  const orgWorkspaces = useMemo(
    () => workspaces.filter((ws) => ws.organization_id === currentOrganization?.id),
    [workspaces, currentOrganization],
  )
  const currentWorkspace =
    orgWorkspaces.find((ws) => ws.id === scope.workspaceId) ?? orgWorkspaces[0] ?? null

  const selectOrganization = useCallback((organizationId: string) => {
    const next = { organizationId, workspaceId: null }
    setScope(next)
    writeScope(next)
  }, [])

  const selectWorkspace = useCallback(
    (workspace: Pick<Workspace, 'id' | 'organization_id'>) => {
      const next = { organizationId: workspace.organization_id, workspaceId: workspace.id }
      setScope(next)
      writeScope(next)
    },
    [],
  )

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all }),
    ])
  }, [queryClient])

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      organizations,
      workspaces,
      currentOrganization,
      currentWorkspace,
      orgWorkspaces,
      isLoading: isAuthenticated && (orgsQuery.isLoading || wsQuery.isLoading),
      selectOrganization,
      selectWorkspace,
      refresh,
    }),
    [
      organizations,
      workspaces,
      currentOrganization,
      currentWorkspace,
      orgWorkspaces,
      isAuthenticated,
      orgsQuery.isLoading,
      wsQuery.isLoading,
      selectOrganization,
      selectWorkspace,
      refresh,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de <WorkspaceProvider>')
  }
  return context
}
