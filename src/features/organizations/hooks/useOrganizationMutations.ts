import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { workspaceKeys } from '@/features/workspaces/api'

import { createOrganization, organizationKeys } from '../api'

export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => createOrganization(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all })
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      toast.success('Organización creada')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo crear la organización')
    },
  })
}
