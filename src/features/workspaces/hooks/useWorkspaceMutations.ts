import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createWorkspace, workspaceKeys } from '../api'
import type { WorkspaceInsert } from '../types'

export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: WorkspaceInsert) => createWorkspace(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      toast.success('Workspace creado')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo crear el workspace')
    },
  })
}
