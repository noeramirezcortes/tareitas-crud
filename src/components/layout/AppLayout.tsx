import { CheckSquare, FolderKanban, LayoutDashboard, ListTodo, LogOut } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { useSession } from '@/features/auth/hooks/useSession'
import { cn } from '@/lib/utils'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-foreground'
      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
  )

/**
 * Layout de la zona autenticada: header con navegación y menú de usuario.
 */
export function AppLayout() {
  const { user } = useSession()
  const logout = useLogout()

  const email = user?.email ?? ''
  const initial = email.charAt(0).toUpperCase() || '?'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
            <CheckSquare className="size-5 text-primary" aria-hidden="true" />
            Tareitas
          </Link>

          <nav className="ml-2 flex items-center gap-1" aria-label="Navegación principal">
            <NavLink to="/dashboard" className={navLinkClass}>
              <LayoutDashboard className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
            </NavLink>
            <NavLink to="/tasks" className={navLinkClass}>
              <ListTodo className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Tareas</span>
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              <FolderKanban className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Proyectos</span>
            </NavLink>
          </nav>

          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar>
                  <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  variant="destructive"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
