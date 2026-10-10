import { Check, ChevronDown, Settings } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { OrganizationFormDialog } from '@/features/organizations/components/OrganizationFormDialog'

import { WorkspaceFormDialog } from './components/WorkspaceFormDialog'
import { useWorkspace } from './WorkspaceContext'

/** Selector de organización y workspace activos, en el header. */
export function OrgWorkspaceSelector() {
  const {
    organizations,
    currentOrganization,
    orgWorkspaces,
    currentWorkspace,
    selectOrganization,
    selectWorkspace,
    isLoading,
  } = useWorkspace()
  const [orgDialogOpen, setOrgDialogOpen] = useState(false)
  const [wsDialogOpen, setWsDialogOpen] = useState(false)

  if (isLoading) {
    return <div className="h-8 w-40" aria-busy="true" />
  }

  return (
    <>
      <div className="flex items-center gap-1 text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-40 items-center gap-1 rounded-md px-2 py-1.5 font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">{currentOrganization?.name ?? 'Sin organización'}</span>
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => selectOrganization(org.id)}>
                <Check
                  className={org.id === currentOrganization?.id ? 'size-4' : 'size-4 opacity-0'}
                  aria-hidden="true"
                />
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setOrgDialogOpen(true)}>Nueva organización</DropdownMenuItem>
            {currentOrganization && (
              <DropdownMenuItem asChild>
                <Link to="/organization">
                  <Settings className="size-4" aria-hidden="true" />
                  Administrar organización
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-muted-foreground" aria-hidden="true">/</span>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex max-w-40 items-center gap-1 rounded-md px-2 py-1.5 font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">{currentWorkspace?.name ?? 'Sin workspace'}</span>
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {orgWorkspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} onSelect={() => selectWorkspace(ws)}>
                <Check
                  className={ws.id === currentWorkspace?.id ? 'size-4' : 'size-4 opacity-0'}
                  aria-hidden="true"
                />
                <span className="truncate">{ws.name}</span>
              </DropdownMenuItem>
            ))}
            {currentOrganization && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setWsDialogOpen(true)}>Nuevo workspace</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <OrganizationFormDialog
        open={orgDialogOpen}
        onOpenChange={setOrgDialogOpen}
        onCreated={(organizationId) => selectOrganization(organizationId)}
      />

      {currentOrganization && (
        <WorkspaceFormDialog
          open={wsDialogOpen}
          onOpenChange={setWsDialogOpen}
          organizationId={currentOrganization.id}
          onCreated={(workspace) => selectWorkspace(workspace)}
        />
      )}
    </>
  )
}
