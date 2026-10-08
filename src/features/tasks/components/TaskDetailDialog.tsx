import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

import { useTask } from '../hooks/useTasks'

interface TaskDetailDialogProps {
  taskId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const dateFormatter = new Intl.DateTimeFormat('es', {
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
                <div className="pt-1">
                  <Badge variant={task.completed ? 'secondary' : 'default'}>
                    {task.completed ? 'Completada' : 'Pendiente'}
                  </Badge>
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

              <div className="grid grid-cols-1 gap-2 border-t pt-3 text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Creada:</span>{' '}
                  {dateFormatter.format(new Date(task.created_at))}
                </p>
                <p>
                  <span className="font-medium text-foreground">Actualizada:</span>{' '}
                  {dateFormatter.format(new Date(task.updated_at))}
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
