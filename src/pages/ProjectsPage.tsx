import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectFormDialog } from '@/features/projects/components/ProjectFormDialog'
import { useDeleteProject } from '@/features/projects/hooks/useProjectMutations'
import { useProjects } from '@/features/projects/hooks/useProjects'
import type { ProjectWithTaskCount } from '@/features/projects/types'

export function ProjectsPage() {
  const { data: projects, isLoading, isError, refetch } = useProjects()
  const deleteProject = useDeleteProject()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectWithTaskCount | null>(null)
  const [deleting, setDeleting] = useState<ProjectWithTaskCount | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (project: ProjectWithTaskCount) => {
    setEditing(project)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteProject.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            {projects ? `${projects.length} en total` : 'Agrupa tus tareas'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Nuevo proyecto</span>
        </Button>
      </div>

      {isLoading && <LoadingSpinner />}

      {isError && (
        <ErrorState description="No se pudieron cargar tus proyectos." onRetry={() => refetch()} />
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No tienes proyectos todavía"
          description="Crea un proyecto para agrupar tareas relacionadas."
          action={
            <Button onClick={openCreate} variant="outline" className="mt-2">
              <Plus className="size-4" aria-hidden="true" />
              Crear proyecto
            </Button>
          }
        />
      )}

      {projects && projects.length > 0 && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Card className="h-full transition-colors hover:border-foreground/20">
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <CardTitle className="text-base">
                    <Link
                      to={`/tasks?project=${project.id}`}
                      className="hover:underline"
                      title="Ver sus tareas"
                    >
                      {project.name}
                    </Link>
                  </CardTitle>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(project)}
                      aria-label={`Editar ${project.name}`}
                      className="size-8"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleting(project)}
                      aria-label={`Eliminar ${project.name}`}
                      className="size-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {project.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <Badge variant="secondary">
                    {project.taskCount} {project.taskCount === 1 ? 'tarea' : 'tareas'}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} project={editing} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar este proyecto?"
        description={
          deleting
            ? `"${deleting.name}" se eliminará. Sus ${deleting.taskCount} ${
                deleting.taskCount === 1 ? 'tarea' : 'tareas'
              } NO se borrarán: quedarán sin proyecto.`
            : undefined
        }
        confirmLabel={deleteProject.isPending ? 'Eliminando…' : 'Eliminar'}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  )
}
