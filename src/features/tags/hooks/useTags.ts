import { useQuery } from '@tanstack/react-query'

import { listTags, tagKeys } from '../api'

export function useTags() {
  return useQuery({
    queryKey: tagKeys.all,
    queryFn: listTags,
  })
}
