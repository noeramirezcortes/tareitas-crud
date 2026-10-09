import { Calendar, Folder } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { TagBadge } from '@/features/tags/components/TagBadge'
import { formatDueDate, isOverdue } from '@/utils/dates'

import { useTask } from '../hooks/useTasks'
import { PRIORITY_LABELS, STATUS_LABELS } from '../types'

interface TaskDetailDialogProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const dateTimeFormatter = new Intl.DateTimeFormat('es', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const { data: task } = useTask(open ? taskId : null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {task ? (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8">{task.title}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Badge variant={task.status === 'done' ? 'secondary' : 'default'}>
                    {STATUS_LABELS[task.status]}
                  </Badge>
                  <Badge variant="outline">Prioridad: {PRIORITY_LABELS[task.priority]}</Badge>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 font-medium">Descripción</p>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {task.description || 'Sin descripción'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t pt-3 sm:grid-cols-2">
                <p className="flex items-center gap-1.5">
                  <Folder className="size-4 text-muted-foreground" aria-hidden="true" />
                  {task.project?.name ?? 'Sin proyecto'}
                </p>
                <p className="flex items-center gap-1.5">
                  <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
                  {task.due_date ? (
                    <span
                      className={
                        task.status !== 'done' && isOverdue(task.due_date)
                          ? 'font-medium text-destructive'
                          : ''
                      }
                    >
                      {formatDueDate(task.due_date)}
                      {task.status !== 'done' && isOverdue(task.due_date) && ' (vencida)'}
                    </span>
                  ) : (
                    'Sin fecha límite'
                  )}
                </p>
              </div>

              {task.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t pt-3">
                  {task.tags.map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 border-t pt-3 text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Creada:</span>{' '}
                  {dateTimeFormatter.format(new Date(task.created_at))}
                </p>
                <p>
                  <span className="font-medium text-foreground">Actualizada:</span>{' '}
                  {dateTimeFormatter.format(new Date(task.updated_at))}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
