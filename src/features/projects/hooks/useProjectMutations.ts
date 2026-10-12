import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createProject, deleteProject, projectKeys, updateProject } from '../api'
import { billingKeys } from '@/features/billing/api'
import { notifyPlanLimit } from '@/features/billing/limits'
import { taskKeys } from '@/features/tasks/api'
import type { ProjectInsert, ProjectUpdate } from '../types'

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ProjectInsert) => createProject(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: billingKeys.all })
      toast.success('Proyecto creado')
    },
    onError: (error) => {
      if (notifyPlanLimit(error)) return
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

interface DeleteProjectInput {
  id: string
  /** Tareas que tenía el proyecto (el servidor las mueve al proyecto por defecto). */
  taskCount: number
  /** Nombre del proyecto por defecto, para el aviso. */
  defaultName: string
}

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: DeleteProjectInput) => deleteProject(id),
    onSuccess: (_data, { taskCount, defaultName }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      queryClient.invalidateQueries({ queryKey: billingKeys.all })
      toast.success(
        taskCount > 0
          ? `Proyecto eliminado. ${taskCount} ${taskCount === 1 ? 'tarea se movió' : 'tareas se movieron'} a ${defaultName}.`
          : 'Proyecto eliminado',
      )
    },
    onError: () => {
      toast.error('No se pudo eliminar el proyecto')
    },
  })
}