import { useQuery } from '@tanstack/react-query'

import { listProjects, projectKeys } from '../api'

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? projectKeys.byWorkspace(workspaceId) : ['projects', 'noop'],
    queryFn: () => listProjects(workspaceId as string),
    enabled: workspaceId !== null,
  })
}