import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

import { useCreateTag, useDeleteTag } from '../hooks/useTagMutations'
import { useTags } from '../hooks/useTags'
import { tagNameSchema } from '../schemas'
import { TagBadge } from './TagBadge'

interface ManageTagsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Gestión de etiquetas reutilizables: crear y eliminar.
 * (La asignación a tareas se hace desde el formulario de tarea.)
 */
export function ManageTagsDialog({ open, onOpenChange }: ManageTagsDialogProps) {
  const { data: tags } = useTags()
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()
  const [name, setName] = useState('')

  const handleCreate = () => {
    const parsed = tagNameSchema.safeParse(name)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Nombre inválido')
      return
    }
    createTag.mutate(parsed.data, {
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
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleCreate()
              }
            }}
            placeholder="Nueva etiqueta…"
          />
          <Button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim() || createTag.isPending}
          >
            Crear
          </Button>
        </div>

        <ul className="max-h-60 space-y-1 overflow-y-auto">
          {tags?.length === 0 && (
            <li className="py-2 text-sm text-muted-foreground">Aún no tienes etiquetas</li>
          )}
          {tags?.map((tag) => (
            <li key={tag.id} className="flex items-center justify-between gap-2">
              <TagBadge tag={tag} />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteTag.mutate(tag.id)}
                disabled={deleteTag.isPending}
                aria-label={`Eliminar etiqueta ${tag.name}`}
                className="size-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
