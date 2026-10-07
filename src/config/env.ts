import { z } from 'zod'

/**
 * Variables de entorno validadas al arranque (fail-fast).
 *
 * IMPORTANTE: todo VITE_* es PÚBLICO en el bundle del frontend.
 * Nunca poner aquí la service_role key ni ningún secreto.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = envSchema.parse(import.meta.env)
