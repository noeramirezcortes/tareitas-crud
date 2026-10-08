import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getTask, listTasks, taskKeys } from '../api'
import type { Task } from '../types'

export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
    queryFn: listTasks,
  })
}

/**
 * Consulta una tarea por id (operación "consultar" del CRUD).
 * Usa la lista cacheada como placeholder para mostrar al instante
 * mientras llega el dato fresco de la DB.
 */
export function useTask(id: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: id ? taskKeys.detail(id) : ['tasks', 'noop'],
    queryFn: () => getTask(id as string),
    enabled: id !== null,
    placeholderData: () => {
      if (!id) return undefined
      return queryClient.getQueryData<Task[]>(taskKeys.all)?.find((task) => task.id === id)
    },
  })
}
