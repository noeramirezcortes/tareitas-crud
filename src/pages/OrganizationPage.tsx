import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/hooks/useSession'
import { InvitationsPanel } from '@/features/invitations/components/InvitationsPanel'
import { MembersPanel } from '@/features/memberships/components/MembersPanel'
import { useMembers } from '@/features/memberships/hooks/useMembers'
import type { OrgRole } from '@/features/organizations/types'
import { WorkspaceFormDialog } from '@/features/workspaces/components/WorkspaceFormDialog'
import { useWorkspace } from '@/features/workspaces/WorkspaceContext'

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Miembro',
}

export function OrganizationPage() {
  const { user } = useSession()
  const { currentOrganization, orgWorkspaces, currentWorkspace, selectWorkspace, isLoading } = useWorkspace()
  const members = useMembers(currentOrganization?.id ?? null)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)

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
        <MembersPanel organizationId={currentOrganization.id} myUserId={user.id} myRole={myRole} />
      </section>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Invitaciones</h2>
          <InvitationsPanel organizationId={currentOrganization.id} myUserId={user.id} isOwner={isOwner} />
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

      <WorkspaceFormDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        organizationId={currentOrganization.id}
        onCreated={(workspace) => selectWorkspace(workspace)}
      />
    </div>
  )
}
