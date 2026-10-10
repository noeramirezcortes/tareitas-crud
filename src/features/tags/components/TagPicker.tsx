import { Check, Plus, Tags } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { tagNameSchema } from '../schemas'
import type { Tag } from '../types'

interface TagPickerProps {
  /** Etiquetas disponibles del usuario. */
  options: Tag[]
  /** Ids actualmente seleccionados. */
  value: string[]
  onChange: (tagIds: string[]) => void
  /** ID del workspace actual (para crear etiquetas en el workspace correcto). */
  workspaceId: string
  /** Crear etiqueta al vuelo; debe devolver la etiqueta creada. */
  onCreateTag: (name: string, workspaceId: string) => Promise<import('@/features/tags/types').Tag>
}

export function TagPicker({ options, value, onChange, workspaceId, onCreateTag }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const selected = options.filter((tag) => value.includes(tag.id))
  const trimmed = newName.trim()
  const nameExists = options.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())

  const toggle = (tagId: string) => {
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId])
  }

  const handleCreate = async () => {
    const parsed = tagNameSchema.safeParse(newName)
    if (!parsed.success) {
      setCreateError(parsed.error.issues[0]?.message ?? 'Nombre inválido')
      return
    }
    if (nameExists) {
      setCreateError('Ya existe una etiqueta con ese nombre')
      return
    }

    setIsCreating(true)
    setCreateError(null)
    try {
      const created = await onCreateTag(parsed.data, workspaceId)
      onChange([...value, created.id])
      setNewName('')
    } catch {
      setCreateError('No se pudo crear la etiqueta')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              title="Quitar etiqueta"
              className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-secondary/70"
            >
              {tag.name} ✕
            </button>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="w-full justify-start">
            <Tags className="size-4" aria-hidden="true" />
            {selected.length === 0 ? 'Añadir etiquetas' : 'Editar etiquetas'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value)
                setCreateError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleCreate()
                }
              }}
              placeholder="Nueva etiqueta…"
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCreate}
              disabled={!trimmed || nameExists || isCreating}
              aria-label="Crear etiqueta"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {createError && <p className="mt-1 text-xs text-destructive">{createError}</p>}

          <ul className="mt-2 max-h-48 overflow-y-auto">
            {options.length === 0 && (
              <li className="px-2 py-1 text-sm text-muted-foreground">
                Aún no tienes etiquetas
              </li>
            )}
            {options.map((tag) => {
              const isSelected = value.includes(tag.id)
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => toggle(tag.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent',
                      isSelected && 'font-medium',
                    )}
                  >
                    <Check
                      className={cn('size-4', isSelected ? 'opacity-100' : 'opacity-0')}
                      aria-hidden="true"
                    />
                    {tag.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}