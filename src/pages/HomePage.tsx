import { CheckSquare } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks/useSession'

export function HomePage() {
  const { isAuthenticated } = useSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4 text-center">
      <div className="flex items-center gap-2 text-3xl font-bold">
        <CheckSquare className="size-8 text-primary" aria-hidden="true" />
        Tareitas
      </div>
      <p className="max-w-md text-muted-foreground">
        Gestión de tareas simple y moderna. Organiza tu día sin fricción.
      </p>
      <div className="flex gap-3">
        {isAuthenticated ? (
          <Button asChild>
            <Link to="/dashboard">Ir al dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register">Crear cuenta</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}
