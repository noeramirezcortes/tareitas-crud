import { useQuery } from '@tanstack/react-query'

import { listTags, tagKeys } from '../api'

export function useTags(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? tagKeys.byWorkspace(workspaceId) : ['tags', 'noop'],
    queryFn: () => listTags(workspaceId as string),
    enabled: workspaceId !== null,
  })
}