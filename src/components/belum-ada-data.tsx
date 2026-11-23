import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

/**
 * Empty state. The dashboard never shows sample or placeholder data: beginners
 * can't tell it apart from their real data. When there is nothing yet, say so
 * and give the one next step.
 */
export function BelumAdaData({
  judul = 'Belum ada data',
  isi,
  ikon: Ikon = Inbox,
  aksi,
}: {
  judul?: string
  isi: ReactNode
  ikon?: LucideIcon
  aksi?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <Ikon className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-lg font-semibold">{judul}</p>
      <p className="max-w-md text-base text-muted-foreground">{isi}</p>
      {aksi}
    </div>
  )
}
