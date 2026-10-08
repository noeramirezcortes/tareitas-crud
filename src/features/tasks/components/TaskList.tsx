import { TaskItem } from './TaskItem'
import type { Task } from '../types'

interface TaskListProps {
  tasks: Task[]
  onToggle: (task: Task) => void
  onView: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
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
