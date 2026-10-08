/**
 * Tipos de la base de datos.
 *
 * ⚠️ Escrito a mano en Fase 1 (solo tabla tasks).
 * Cuando el proyecto Supabase esté vinculado con la CLI, regenerar con:
 *
 *   pnpm db:types
 *
 * que sobrescribirá este archivo con los tipos generados desde la DB real.
 */
export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          description?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
