import { useQuery, useQueryClient } from '@tanstack/react-query'

import { getTask, listTasks, taskKeys } from '../api'
import type { TaskFilters, TaskWithRelations } from '../types'

/**
 * Lista de tareas con filtros (aplicados en servidor).
 * La queryKey incluye los filtros: cada combinación tiene su caché.
 */
export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: () => listTasks(filters),
  })
}

/**
 * Consulta una tarea por id. Usa cualquier lista cacheada como
 * placeholder mientras llega el dato fresco de la DB.
 */
export function useTask(id: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: id ? taskKeys.detail(id) : ['tasks', 'noop'],
    queryFn: () => getTask(id as string),
    enabled: id !== null,
    placeholderData: () => {
      if (!id) return undefined
      const cachedLists = queryClient.getQueriesData<TaskWithRelations[]>({
        queryKey: taskKeys.all,
      })
      for (const [, tasks] of cachedLists) {
        const found = tasks?.find((task) => task.id === id)
        if (found) return found
      }
      return undefined
    },
  })
}
