import { useState } from 'react'
import { Bell, Check, ClipboardCopy, Database, Download, FlaskConical, History, OctagonX, Play, Plug, ScanSearch, Settings, Upload } from 'lucide-react'
import { BelumAdaData } from '@/components/belum-ada-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DataDashboard } from '@/hooks/use-data'
import { sensorTeks } from '@/lib/sensor'
import type { JenisRiwayat, Riwayat as EntriRiwayat } from '@/lib/types'
import { cn, waktuRamah } from '@/lib/utils'

const ikon: Record<JenisRiwayat, typeof Play> = {
  otomasi: Play,
  uji: FlaskConical,
  alarm: Bell,
  impor: Upload,
  data: Database,
  cadangan: Download,
  sambungan: Plug,
  survei: ScanSearch,
  galat: OctagonX,
  pengaturan: Settings,
}

/**
 * What the copy button copies, per kind of entry. Everything goes through
 * sensorTeks: it goes to the agent's AI, so no phone numbers or e-mails.
 * (Survey and bukti entries are already censored when they are written.)
 */
function salinan(r: EntriRiwayat): { label: string; teks: string } | null {
  const s = isiSalinan(r)
  return s && { ...s, teks: sensorTeks(s.teks) }
}

function isiSalinan(r: EntriRiwayat): { label: string; teks: string } | null {
  if (!r.teknis) return null
  if (r.jenis === 'survei') return { label: 'Salin hasil survei untuk agent', teks: r.teknis }
  if (r.jenis === 'sambungan') return { label: 'Salin bukti untuk agent', teks: r.teknis }
  return {
    label: 'Salin laporan untuk agent',
    teks: [
      'Laporan masalah dari Dashboard Otomasi',
      `Waktu: ${new Date(r.waktu).toLocaleString('id-ID')}`,
      `Yang terlihat di dashboard: ${r.ringkas}`,
      ...(r.detail?.length ? ['Langkah yang tercatat:', ...r.detail.map((d) => `- ${d}`)] : []),
      'Yang seharusnya terjadi: (tulis di sini)',
      '',
      'Detail teknis:',
      r.teknis,
      '',
      `Browser: ${navigator.userAgent}`,
    ].join('\n'),
  }
}

export function Riwayat({ data }: { data: DataDashboard }) {
  const [disalin, setDisalin] = useState<number | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Riwayat</CardTitle>
        <CardDescription className="text-base">Semua yang dikerjakan dashboard ini, yang terbaru di atas.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.riwayat.length === 0 && (
          <BelumAdaData ikon={History} judul="Belum ada kegiatan" isi="Setiap impor, survei, tes sambungan, dan otomasi akan tercatat di sini." />
        )}
        <ol className="flex flex-col divide-y">
          {data.riwayat.map((r) => {
            const Ikon = ikon[r.jenis]
            const s = salinan(r)
            return (
              <li key={r.id} className="flex gap-4 py-4 first:pt-0">
                <Ikon
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    r.jenis === 'galat' ? 'text-destructive' : r.jenis === 'alarm' ? 'text-warning' : r.jenis === 'sambungan' ? 'text-success' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{waktuRamah(r.waktu)}</p>
                  <p className="text-base">{r.ringkas}</p>
                  {r.detail && r.detail.length > 0 && (
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Lihat {r.detail.length} rincian</summary>
                      <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
                        {r.detail.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {s && (
                    <Button
                      variant="outline"
                      className="mt-2 h-10"
                      onClick={async () => {
                        await navigator.clipboard.writeText(s.teks)
                        setDisalin(r.id ?? null)
                        setTimeout(() => setDisalin(null), 2000)
                      }}
                    >
                      {disalin === r.id ? <Check /> : <ClipboardCopy />}
                      {disalin === r.id ? 'Disalin' : s.label}
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
