import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { taskKeys } from '@/features/tasks/api'

import { createTag, deleteTag, tagKeys } from '../api'

export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => createTag({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tagKeys.all })
    },
    onError: (error) => {
      // unique(user_id, name) — el usuario ya tiene una etiqueta con ese nombre
      if (error.message.includes('23505') || error.message.toLowerCase().includes('unique')) {
        toast.error('Ya existe una etiqueta con ese nombre')
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
      // Las tareas pierden el vínculo (ON DELETE CASCADE): refrescar
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
      toast.success('Etiqueta eliminada')
    },
    onError: () => {
      toast.error('No se pudo eliminar la etiqueta')
    },
  })
}

