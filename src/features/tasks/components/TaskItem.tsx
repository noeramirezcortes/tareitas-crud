import { Calendar, Eye, Folder, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TagBadge } from '@/features/tags/components/TagBadge'
import { cn } from '@/lib/utils'
import { formatDueDate, isOverdue } from '@/utils/dates'

import type { TaskPriority, TaskWithRelations } from '../types'
import { PRIORITY_LABELS } from '../types'

interface TaskItemProps {
  task: TaskWithRelations
  onToggle: (task: TaskWithRelations) => void
  onView: (task: TaskWithRelations) => void
  onEdit: (task: TaskWithRelations) => void
  onDelete: (task: TaskWithRelations) => void
}

const PRIORITY_VARIANTS: Record<TaskPriority, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
}

export function TaskItem({ task, onToggle, onView, onEdit, onDelete }: TaskItemProps) {
  const isDone = task.status === 'done'
  const overdue = !isDone && isOverdue(task.due_date)

  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <Checkbox
        id={`task-${task.id}`}
        checked={isDone}
        onCheckedChange={() => onToggle(task)}
        className="mt-1"
        aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como completada'}
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            'block cursor-pointer font-medium',
            isDone && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </label>

        {task.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={PRIORITY_VARIANTS[task.priority]}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>

          {task.status === 'in_progress' && <Badge variant="default">En progreso</Badge>}

          {task.project && (
            <Badge variant="outline" className="font-normal">
              <Folder className="size-3" aria-hidden="true" />
              {task.project.name}
            </Badge>
          )}

          {task.due_date && (
            <Badge
              variant="outline"
              className={cn('font-normal', overdue && 'border-destructive text-destructive')}
            >
              <Calendar className="size-3" aria-hidden="true" />
              {formatDueDate(task.due_date)}
            </Badge>
          )}

          {task.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={() => onView(task)} aria-label="Ver tarea">
          <Eye className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onEdit(task)} aria-label="Editar tarea">
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task)}
          aria-label="Eliminar tarea"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  )
}
