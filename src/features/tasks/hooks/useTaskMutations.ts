import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createTask, deleteTask, taskKeys, updateTask } from '../api'
import type { TaskInsert, TaskStatus, TaskUpdate } from '../types'

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ tagIds = [], ...input }: TaskInsert & { tagIds?: string[] }) =>
      createTask(input, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Tarea creada')
    },
    onError: () => {
      toast.error('No se pudo crear la tarea')
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, tagIds, ...input }: TaskUpdate & { id: string; tagIds?: string[] }) =>
      updateTask(id, input, tagIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Tarea actualizada')
    },
    onError: () => {
      toast.error('No se pudo actualizar la tarea')
    },
  })
}

export function useToggleTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTask(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
    onError: () => {
      toast.error('No se pudo actualizar la tarea')
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Tarea eliminada')
    },
    onError: () => {
      toast.error('No se pudo eliminar la tarea')
    },
  })
}
