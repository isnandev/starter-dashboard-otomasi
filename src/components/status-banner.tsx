import { CircleAlert, CircleCheck, OctagonX } from 'lucide-react'
import type { StatusUmum } from '@/lib/types'
import { cn } from '@/lib/utils'

const gaya = {
  aman: { ikon: CircleCheck, kelas: 'border-success/40 bg-success/10', warnaIkon: 'text-success', label: 'Aman' },
  perhatian: { ikon: CircleAlert, kelas: 'border-warning/40 bg-warning/10', warnaIkon: 'text-warning', label: 'Perlu perhatian' },
  berhenti: { ikon: OctagonX, kelas: 'border-destructive/40 bg-destructive/10', warnaIkon: 'text-destructive', label: 'Berhenti' },
}

/** Status in one sentence. Colour + icon + words, never colour alone. */
export function StatusBanner({ status, aksi }: { status: StatusUmum; aksi?: React.ReactNode }) {
  const g = gaya[status.tingkat]
  const Ikon = g.ikon
  return (
    <div role="status" className={cn('flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center', g.kelas)}>
      <Ikon className={cn('size-10 shrink-0', g.warnaIkon)} aria-hidden />
      <div className="flex-1">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{g.label}</p>
        <p className="text-2xl font-semibold leading-tight">{status.kalimat}</p>
        {status.saran && <p className="mt-1 text-base text-muted-foreground">{status.saran}</p>}
      </div>
      {aksi}
    </div>
  )
}
