import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useTags } from '@/features/tags/hooks/useTags'
import { useWorkspace } from '@/features/workspaces/WorkspaceContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

import type { TaskPriority, TaskStatus } from '../types'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../types'

export function TasksFilters() {
  const { currentWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: projects } = useProjects(currentWorkspace?.id ?? null)
  const { data: tags } = useTags(currentWorkspace?.id ?? null)

  const urlText = searchParams.get('q') ?? ''
  const [textInput, setTextInput] = useState(urlText)
  const debouncedText = useDebouncedValue(textInput, 300)

  // Sincroniza el texto con debounce hacia la URL (?q=)
  useEffect(() => {
    const term = debouncedText.trim()
    if (term === urlText) return
    const next = new URLSearchParams(searchParams)
    if (term) next.set('q', term)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }, [debouncedText, urlText, searchParams, setSearchParams])

  const hasActiveFilters =
    urlText !== '' ||
    ['project', 'priority', 'status', 'due', 'tag'].some((key) => searchParams.get(key))

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
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
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value === 'all') next.delete('project')
            else next.set('project', value)
            setSearchParams(next, { replace: true })
          }}
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
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value === 'all') next.delete('priority')
            else next.set('priority', value)
            setSearchParams(next, { replace: true })
          }}
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
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value === 'all') next.delete('status')
            else next.set('status', value)
            setSearchParams(next, { replace: true })
          }}
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
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value === 'all') next.delete('due')
            else next.set('due', value)
            setSearchParams(next, { replace: true })
          }}
        >
          <SelectTrigger aria-label="Filtrar por fecha">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Cualquier fecha</SelectItem>
            <SelectItem value="overdue">Vencidas</SelectItem>
            <SelectItem value="today">Vencen hoy</SelectItem>
            <SelectItem value="week">Próximos 7 días</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('tag') ?? 'all'}
          onValueChange={(value) => {
            const next = new URLSearchParams(searchParams)
            if (value === 'all') next.delete('tag')
            else next.set('tag', value)
            setSearchParams(next, { replace: true })
          }}
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
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  )
}