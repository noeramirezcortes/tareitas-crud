import { z } from 'zod'

/**
 * Espejo de los constraints de la tabla tasks.
 * En el formulario, '' y 'none' son centinelas de "vacío" que la capa
 * de diálogo convierte a null antes de llamar a la API.
 */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200, 'Máximo 200 caracteres'),
  description: z.string().trim().max(1000, 'Máximo 1000 caracteres').optional(),
  project_id: z.string(), // 'none' = sin proyecto
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['pending', 'in_progress', 'done']),
  due_date: z.string(), // '' = sin fecha; input type=date emite 'yyyy-mm-dd'
  tagIds: z.array(z.string()),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>
