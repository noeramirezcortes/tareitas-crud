import { Eye, Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import type { Task } from '../types'

interface TaskItemProps {
  task: Task
  onToggle: (task: Task) => void
  onView: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

export function TaskItem({ task, onToggle, onView, onEdit, onDelete }: TaskItemProps) {
  return (
    <li className="flex items-start gap-3 rounded-lg border bg-card p-3">
      <Checkbox
        id={`task-${task.id}`}
        checked={task.completed}
        onCheckedChange={() => onToggle(task)}
        className="mt-1"
        aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
      />

      <div className="min-w-0 flex-1">
        <label
          htmlFor={`task-${task.id}`}
          className={cn(
            'block cursor-pointer font-medium',
            task.completed && 'text-muted-foreground line-through',
          )}
        >
          {task.title}
        </label>
        {task.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
        )}
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
