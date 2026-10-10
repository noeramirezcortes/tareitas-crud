import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createProject, deleteProject, projectKeys, updateProject } from '../api'
import { taskKeys } from '@/features/tasks/api'
import type { ProjectInsert, ProjectUpdate } from '../types'

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ProjectInsert) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Proyecto creado')
    },
    onError: () => {
      toast.error('No se pudo crear el proyecto')
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: ProjectUpdate & { id: string }) => updateProject(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Proyecto actualizado')
    },
    onError: () => {
      toast.error('No se pudo actualizar el proyecto')
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Proyecto eliminado')
    },
    onError: () => {
      toast.error('No se pudo eliminar el proyecto')
    },
  })
}