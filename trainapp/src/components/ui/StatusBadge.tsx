import { cn, STATUS_CONFIG } from '@/lib/utils'
import type { BookingStatusEnum } from '@/types'

export default function StatusBadge({ status }: { status: BookingStatusEnum }) {
  const { label, color, bg } = STATUS_CONFIG[status]
  return (
    <span className={cn('badge border', bg, color)}>
      {label}
    </span>
  )
}
