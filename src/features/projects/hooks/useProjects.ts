import { useQuery } from '@tanstack/react-query'

import { listProjects, projectKeys } from '../api'

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: listProjects,
  })
}
