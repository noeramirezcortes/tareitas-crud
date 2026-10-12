import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useRegister } from '../hooks/useRegister'
import { getRedirectFrom } from '../redirect'
import { registerSchema } from '../schemas'
import type { RegisterValues } from '../schemas'

export function RegisterForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const registerMutation = useRegister()

  // Ruta a la que el usuario quería ir (p. ej. /invite/:token) antes de registrarse.
  const from = getRedirectFrom(location.state)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = handleSubmit((values) => {
    // El correo de confirmación debe llevar de vuelta al destino original.
    const redirectTo = from ? `${window.location.origin}${from}` : undefined

    registerMutation.mutate({ ...values, redirectTo }, {
      onSuccess: (data) => {
        if (data.session) {
          // Confirmación de email desactivada → sesión inmediata
          toast.success('Cuenta creada. ¡Bienvenido!')
          navigate(from ?? '/dashboard', { replace: true })
        } else {
          // Confirmación de email activada (default de Supabase)
          toast.info('Revisa tu correo para confirmar la cuenta y luego inicia sesión.')
          navigate('/login', { replace: true, state: location.state })
        }
      },
    })
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@email.com"
          aria-invalid={!!errors.email}
          {...register('email')}
        />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
        {registerMutation.isPending ? 'Creando cuenta…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}
