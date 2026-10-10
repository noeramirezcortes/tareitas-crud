import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { taskKeys } from '@/features/tasks/api'

import { createTag, deleteTag, tagKeys } from '../api'

export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { name: string; workspace_id: string }) => createTag(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
      toast.success('Etiqueta creada')
    },
    onError: (error) => {
      if (error.message?.includes('23505') || error.message?.toLowerCase().includes('unique')) {
        toast.error('Ya existe una etiqueta con ese nombre en este workspace')
      } else {
        toast.error('No se pudo crear la etiqueta')
      }
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTag(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Etiqueta eliminada')
    },
    onError: () => {
      toast.error('No se pudo eliminar la etiqueta')
    },
  })
}