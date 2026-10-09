import { z } from 'zod'

/**
 * Variables de entorno validadas al arranque (fail-fast).
 *
 * IMPORTANTE: todo VITE_* es PÚBLICO en el bundle del frontend.
 * Nunca poner aquí la service_role key ni ningún secreto.
 */
const envSchema = z.object({
  // La URL debe ser la base del proyecto, sin paths como /rest/v1
  VITE_SUPABASE_URL: z
    .url()
    .refine((url) => ['/', ''].includes(new URL(url).pathname), {
      message:
        'VITE_SUPABASE_URL debe ser la URL base del proyecto (sin /rest/v1 ni otros paths)',
    }),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = envSchema.parse(import.meta.env)
