import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/hooks/useSession'
import { InvitationsPanel } from '@/features/invitations/components/InvitationsPanel'
import { MembersPanel } from '@/features/memberships/components/MembersPanel'
import { useMembers } from '@/features/memberships/hooks/useMembers'
import { useDeleteOrganization } from '@/features/organizations/hooks/useOrganizationMutations'
import type { OrgRole } from '@/features/organizations/types'
import { WorkspaceFormDialog } from '@/features/workspaces/components/WorkspaceFormDialog'
import { useDeleteWorkspace } from '@/features/workspaces/hooks/useWorkspaceMutations'
import { countWorkspaceContents } from '@/features/workspaces/api'
import { useWorkspace } from '@/features/workspaces/useWorkspace'

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Miembro',
}

export function OrganizationPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const { currentOrganization, orgWorkspaces, currentWorkspace, selectWorkspace, refresh, isLoading } = useWorkspace()
  const members = useMembers(currentOrganization?.id ?? null)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [workspaceToDelete, setWorkspaceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [orgDeleteOpen, setOrgDeleteOpen] = useState(false)
  const deleteWorkspace = useDeleteWorkspace()
  const deleteOrganization = useDeleteOrganization()
  const workspaceContents = useQuery({
    queryKey: ['workspace-contents', workspaceToDelete?.id],
    queryFn: () => countWorkspaceContents(workspaceToDelete!.id),
    enabled: workspaceToDelete !== null,
  })

  // Tras salir de la organización, el contexto cae a la primera disponible.
  const handleLeftOrganization = async () => {
    await refresh()
    navigate('/dashboard')
  }

  if (isLoading) return <LoadingSpinner />
  if (!currentOrganization || !user) {
    return (
      <EmptyState
        title="No perteneces a ninguna organización"
        description="Crea una desde el selector del encabezado."
      />
    )
  }

  const myRole = members.data?.find((member) => member.user_id === user.id)?.role
  const isOwner = myRole === 'owner'
  const isAdmin = isOwner || myRole === 'admin'

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{currentOrganization.name}</h1>
          <p className="text-sm text-muted-foreground">Organización y equipo</p>
        </div>
        {myRole && <Badge variant="secondary">Tu rol: {ROLE_LABELS[myRole]}</Badge>}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Workspaces</CardTitle>
            <CardDescription>Agrupan proyectos y etiquetas dentro de la organización.</CardDescription>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={() => setWorkspaceDialogOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Nuevo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {orgWorkspaces.map((ws) => (
              <li key={ws.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ws.name}</p>
                  {ws.description && <p className="truncate text-xs text-muted-foreground">{ws.description}</p>}
                </div>
                {ws.id === currentWorkspace?.id ? (
                  <Badge>Activo</Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => selectWorkspace(ws)}>
                    Usar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Miembros</h2>
        <MembersPanel
          organizationId={currentOrganization.id}
          myUserId={user.id}
          myRole={myRole}
          onLeft={handleLeftOrganization}
        />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Invitaciones</h2>
          <InvitationsPanel organizationId={currentOrganization.id} isOwner={isOwner} />
        </section>
      )}

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          Sólo owners y admins pueden invitar personas.{' '}
          <Link to="/dashboard" className="font-medium text-primary hover:underline">
            Volver al dashboard
          </Link>
        </p>
      )}

      {isOwner && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Zona de peligro</h2>
          <Card className="border-destructive/50">
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Workspaces</h3>
                <p className="text-sm text-muted-foreground">
                  Borrar un workspace elimina sus proyectos, etiquetas y tareas. El último workspace
                  no se puede borrar.
                </p>
                <ul className="space-y-2">
                  {orgWorkspaces.map((ws) => (
                    <li key={ws.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm">{ws.name}</span>
                      {orgWorkspaces.length > 1 ? (
                        <Button variant="outline" size="sm" onClick={() => setWorkspaceToDelete(ws)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                          Eliminar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Último workspace: no se puede borrar</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Organización</h3>
                <p className="text-sm text-muted-foreground">
                  Eliminar la organización borra todo lo que contiene: workspaces, proyectos, etiquetas,
                  tareas, miembros e invitaciones. Esta acción no se puede deshacer.
                </p>
                <Button variant="destructive" size="sm" onClick={() => setOrgDeleteOpen(true)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Eliminar organización
                </Button>
              </div>
            </CardContent>
          </Card>

          <ConfirmDialog
            open={workspaceToDelete !== null}
            onOpenChange={(open) => !open && setWorkspaceToDelete(null)}
            title={`Eliminar workspace "${workspaceToDelete?.name ?? ''}"`}
            description={
              workspaceContents.data
                ? `Se eliminarán ${workspaceContents.data.projects} proyectos, ${workspaceContents.data.tags} etiquetas y ${workspaceContents.data.tasks} ${workspaceContents.data.tasks === 1 ? 'tarea' : 'tareas'}. Esta acción no se puede deshacer.`
                : 'Calculando el contenido…'
            }
            confirmLabel="Eliminar workspace"
            destructive
            onConfirm={() =>
              workspaceToDelete &&
              deleteWorkspace.mutate(workspaceToDelete.id, {
                onSuccess: async () => {
                  setWorkspaceToDelete(null)
                  await refresh()
                },
              })
            }
          />

          <ConfirmDialog
            open={orgDeleteOpen}
            onOpenChange={setOrgDeleteOpen}
            title={`Eliminar organización "${currentOrganization.name}"`}
            description="Se eliminarán la organización y todo su contenido (workspaces, proyectos, etiquetas, tareas, miembros e invitaciones). Esta acción no se puede deshacer."
            confirmLabel="Eliminar definitivamente"
            destructive
            onConfirm={() =>
              deleteOrganization.mutate(currentOrganization.id, {
                onSuccess: async () => {
                  setOrgDeleteOpen(false)
                  await refresh()
                  navigate('/dashboard')
                },
              })
            }
          />
        </section>
      )}

      <WorkspaceFormDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        organizationId={currentOrganization.id}
        onCreated={(workspace) => selectWorkspace(workspace)}
      />
    </div>
  )
}
