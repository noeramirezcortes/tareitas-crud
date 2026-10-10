import { useState } from 'react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCreateTag, useDeleteTag } from '../hooks/useTagMutations'
import { useTags } from '../hooks/useTags'
import { tagNameSchema } from '../schemas'
import { TagBadge } from './TagBadge'

interface ManageTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
}

export function ManageTagsDialog({ open, onOpenChange, workspaceId }: ManageTagsDialogProps) {
  const { data: tags } = useTags(workspaceId)
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()
  const [name, setName] = useState('')

  const handleCreate = () => {
    const parsed = tagNameSchema.safeParse(name)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Nombre inválido')
      return
    }
    createTag.mutate({ name: parsed.data, workspace_id: workspaceId }, {
      onSuccess: () => {
        setName('')
        toast.success('Etiqueta creada')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Etiquetas</DialogTitle>
          <DialogDescription>
            Las etiquetas son reutilizables: asígnalas desde el formulario de cada tarea. Al
            eliminar una etiqueta se quita de todas las tareas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleCreate()
              }
            }}
            placeholder="Nueva etiqueta…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createTag.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Crear
          </button>
        </div>

        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {tags?.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">Aún no tienes etiquetas</li>
          )}
          {tags?.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2">
              <TagBadge tag={tag} />
              <button
                type="button"
                onClick={() => deleteTag.mutate(tag.id)}
                disabled={deleteTag.isPending}
                aria-label={`Eliminar etiqueta ${tag.name}`}
                className="rounded size-8 text-destructive hover:bg-destructive/10"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v12m-6 0h14" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}