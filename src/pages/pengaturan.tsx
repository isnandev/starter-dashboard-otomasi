import { useRef, useState } from 'react'
import { Konfirmasi } from '@/components/konfirmasi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DataDashboard } from '@/hooks/use-data'
import { hapusSemua, pulihkanCadangan, tambahRiwayat, ubahPengaturan } from '@/lib/db'
import type { Pengaturan as JenisPengaturan } from '@/lib/types'
import { cn, diExtension } from '@/lib/utils'

const PILIHAN_INTERVAL = [5, 15, 30, 60]
const PILIHAN_TEMA: { nilai: JenisPengaturan['tema']; label: string }[] = [
  { nilai: 'terang', label: 'Terang' },
  { nilai: 'gelap', label: 'Gelap' },
  { nilai: 'sistem', label: 'Ikuti komputer' },
]

export function Pengaturan({ data, muat }: { data: DataDashboard; muat: () => Promise<void> }) {
  const set = data.pengaturan
  const [nama, setNama] = useState(set.namaUsaha)
  const [galat, setGalat] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function ubah(ubahan: Partial<JenisPengaturan>, catatan: string) {
    await ubahPengaturan(ubahan)
    await tambahRiwayat({ jenis: 'pengaturan', ringkas: catatan })
    if (diExtension) chrome.runtime.sendMessage({ jenis: 'jadwal-ulang' }).catch(() => {})
    await muat()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Usaha</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="nama" className="text-base">Nama usaha</Label>
            <Input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} className="h-11 text-base" />
          </div>
          <Button className="h-11 text-base" disabled={!nama.trim() || nama === set.namaUsaha} onClick={() => ubah({ namaUsaha: nama.trim() }, `Nama usaha diganti menjadi ${nama.trim()}`)}>
            Simpan
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Jadwal otomasi</CardTitle>
          <CardDescription className="text-base">Seberapa sering otomasi terjadwal berjalan, selama Chrome terbuka.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PILIHAN_INTERVAL.map((m) => (
            <Button
              key={m}
              variant={set.intervalMenit === m ? 'default' : 'outline'}
              className="h-11 min-w-28 text-base"
              aria-pressed={set.intervalMenit === m}
              onClick={() => ubah({ intervalMenit: m }, `Jadwal otomasi diubah: setiap ${m} menit`)}
            >
              Setiap {m} menit
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Tampilan</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {PILIHAN_TEMA.map((t) => (
            <Button
              key={t.nilai}
              variant={set.tema === t.nilai ? 'default' : 'outline'}
              className="h-11 text-base"
              aria-pressed={set.tema === t.nilai}
              onClick={() => ubah({ tema: t.nilai }, `Tampilan diganti: ${t.label}`)}
            >
              {t.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Data</CardTitle>
          <CardDescription className="text-base">Semua data tersimpan di komputer ini. Tidak ada yang dikirim ke internet.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 text-base" onClick={() => fileRef.current?.click()}>
            Pulihkan dari cadangan
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setGalat(null)
              try {
                await pulihkanCadangan(await f.text())
                await tambahRiwayat({ jenis: 'cadangan', ringkas: `Data dipulihkan dari ${f.name}` })
                await muat()
              } catch (err) {
                setGalat(err instanceof Error ? err.message : String(err))
              }
              e.target.value = ''
            }}
          />
          <Button variant="outline" className="h-11 text-base" onClick={() => ubah({ panduanSelesai: false }, 'Panduan 3 langkah ditampilkan lagi')}>
            Tampilkan panduan lagi
          </Button>
          <Konfirmasi
            pemicu={<Button variant="outline" className={cn('h-11 text-base text-destructive')}>Hapus semua data</Button>}
            judul="Hapus semua data?"
            isi="Semua tabel, riwayat, dan pengaturan di komputer ini akan dihapus dan tidak bisa dikembalikan, kecuali kamu punya file cadangan."
            tombolYa="Ya, hapus semua"
            bahaya
            onYa={async () => {
              await hapusSemua()
              await muat()
            }}
          />
          {galat && (
            <p role="alert" className="w-full rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-base">
              Cadangan belum bisa dipulihkan: {galat}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
