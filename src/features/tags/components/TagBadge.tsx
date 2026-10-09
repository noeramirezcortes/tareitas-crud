import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { Tag } from '../types'

interface TagBadgeProps {
  tag: Pick<Tag, 'name'>
  className?: string
}

export function TagBadge({ tag, className }: TagBadgeProps) {
  return (
    <Badge variant="outline" className={cn('font-normal', className)}>
      {tag.name}
    </Badge>
  )
}
