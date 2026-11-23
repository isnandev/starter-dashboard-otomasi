import type { ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

/** Ask before anything that overwrites or deletes. Plain words, clear buttons. */
export function Konfirmasi({
  pemicu,
  judul,
  isi,
  tombolYa,
  bahaya = false,
  onYa,
}: {
  pemicu: ReactNode
  judul: string
  isi: ReactNode
  tombolYa: string
  bahaya?: boolean
  onYa: () => void
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{pemicu}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{judul}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-base text-muted-foreground">{isi}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 text-base">Batal</AlertDialogCancel>
          <AlertDialogAction
            className={cn('h-11 text-base', bahaya && 'bg-destructive text-white hover:bg-destructive/90')}
            onClick={onYa}
          >
            {tombolYa}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
