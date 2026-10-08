import { z } from 'zod'

/**
 * Espejo de los constraints de la tabla tasks (migración 20261008000000).
 * La validación de cliente es UX; la de DB es la última línea.
 */
export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(200, 'Máximo 200 caracteres'),
  description: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
