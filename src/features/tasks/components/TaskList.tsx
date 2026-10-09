import { TaskItem } from './TaskItem'
import type { TaskWithRelations } from '../types'

interface TaskListProps {
  tasks: TaskWithRelations[]
  onToggle: (task: TaskWithRelations) => void
  onView: (task: TaskWithRelations) => void
  onEdit: (task: TaskWithRelations) => void
  onDelete: (task: TaskWithRelations) => void
}

export function TaskList({ tasks, onToggle, onView, onEdit, onDelete }: TaskListProps) {
  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={onToggle}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
