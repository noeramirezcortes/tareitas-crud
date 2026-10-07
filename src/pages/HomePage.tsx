import { CheckCircle2 } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Tareitas</CardTitle>
          <CardDescription>Gestión de tareas simple y moderna</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-5 text-green-500" aria-hidden="true" />
          Fase 0 completada — listo para la Fase 1
        </CardContent>
      </Card>
    </main>
  )
}
