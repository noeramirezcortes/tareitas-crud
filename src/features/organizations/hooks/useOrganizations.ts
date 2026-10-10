import { useQuery } from '@tanstack/react-query'

import { listOrganizations, organizationKeys } from '../api'

export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.all,
    queryFn: listOrganizations,
  })
}