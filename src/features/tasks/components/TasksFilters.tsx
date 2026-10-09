import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useTags } from '@/features/tags/hooks/useTags'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import type { TaskPriority, TaskStatus } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../types'

const DUE_OPTIONS = [
  { value: 'overdue', label: 'Vencidas' },
  { value: 'today', label: 'Vencen hoy' },
  { value: 'week', label: 'Próximos 7 días' },
] as const

/**
 * Barra de búsqueda y filtros de la lista de tareas.
 * Los filtros viven en la URL (?q=&project=&priority=…): son
 * compartibles y sobreviven a la navegación atrás/adelante.
 */
export function TasksFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: projects } = useProjects()
  const { data: tags } = useTags()

  const urlText = searchParams.get('q') ?? ''
  const [textInput, setTextInput] = useState(urlText)
  const debouncedText = useDebouncedValue(textInput, 300)

  // Sincroniza el input cuando la URL cambia por fuera (ej. limpiar filtros)
  useEffect(() => {
    setTextInput(urlText)
  }, [urlText])

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (debouncedText !== urlText) {
      setParam('q', debouncedText.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText])

  const hasActiveFilters =
    urlText !== '' ||
    ['project', 'priority', 'status', 'due', 'tag'].some((key) => searchParams.get(key))

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={textInput}
          onChange={(event) => setTextInput(event.target.value)}
          placeholder="Buscar por título o descripción…"
          className="pl-9"
          aria-label="Buscar tareas"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select
          value={searchParams.get('project') ?? 'all'}
          onValueChange={(value) => setParam('project', value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Filtrar por proyecto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los proyectos</SelectItem>
            <SelectItem value="none">Sin proyecto</SelectItem>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('priority') ?? 'all'}
          onValueChange={(value) => setParam('priority', value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Filtrar por prioridad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda prioridad</SelectItem>
            {TASK_PRIORITIES.map((priority: TaskPriority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('status') ?? 'all'}
          onValueChange={(value) => setParam('status', value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Filtrar por estado">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo estado</SelectItem>
            {TASK_STATUSES.map((status: TaskStatus) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('due') ?? 'all'}
          onValueChange={(value) => setParam('due', value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Filtrar por fecha">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier fecha</SelectItem>
            {DUE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('tag') ?? 'all'}
          onValueChange={(value) => setParam('tag', value === 'all' ? '' : value)}
        >
          <SelectTrigger aria-label="Filtrar por etiqueta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toda etiqueta</SelectItem>
            {tags?.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="justify-start">
            <X className="size-4" aria-hidden="true" />
            Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
