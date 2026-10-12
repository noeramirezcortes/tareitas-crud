import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { organizationKeys } from '@/features/organizations/api'
import { projectKeys } from '@/features/projects/api'
import { tagKeys } from '@/features/tags/api'
import { taskKeys } from '@/features/tasks/api'

import { createWorkspace, deleteWorkspace, workspaceKeys } from '../api'
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

export function useDeleteWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      // Borrar un workspace cambia todo lo que cuelga de él.
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all })
      queryClient.invalidateQueries({ queryKey: organizationKeys.all })
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Workspace eliminado')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo eliminar el workspace')
    },
  })
}
