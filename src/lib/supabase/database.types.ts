/**
 * Tipos de la base de datos.
 *
 * ⚠️ Escrito a mano (Fases 1–3). Cuando el proyecto Supabase esté vinculado
 * con la CLI, regenerar con:
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
          title: string
          description: string | null
          project_id: string | null
          priority: 'low' | 'medium' | 'high'
          status: 'pending' | 'in_progress' | 'done'
          due_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          project_id?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in_progress' | 'done'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          project_id?: string | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'pending' | 'in_progress' | 'done'
          due_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
        ]
      }
      projects: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      tags: {
        Row: {
          id: string
          workspace_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tags_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      task_tags: {
        Row: {
          task_id: string
          tag_id: string
          created_at: string
        }
        Insert: {
          task_id: string
          tag_id: string
          created_at?: string
        }
        Update: {
          task_id?: string
          tag_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_tags_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          organization_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspaces_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      memberships: {
        Row: {
          user_id: string
          organization_id: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }
        Insert: {
          user_id: string
          organization_id: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Update: {
          user_id?: string
          organization_id?: string
          role?: 'owner' | 'admin' | 'member'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memberships_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      invitations: {
        Row: {
          id: string
          email: string
          organization_id: string
          role: 'owner' | 'admin' | 'member'
          invited_by: string
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          organization_id: string
          role?: 'owner' | 'admin' | 'member'
          invited_by: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          organization_id?: string
          role?: 'owner' | 'admin' | 'member'
          invited_by?: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      create_organization: {
        Args: { p_name: string }
        Returns: string
      }
      accept_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      list_org_members: {
        Args: { p_org_id: string }
        Returns: {
          user_id: string
          email: string
          role: 'owner' | 'admin' | 'member'
          created_at: string
        }[]
      }
    }
    Enums: {
      org_role: 'owner' | 'admin' | 'member'
    }
    CompositeTypes: Record<string, never>
  }
}