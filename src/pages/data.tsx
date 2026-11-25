import { useRef, useState } from 'react'
import { Database, Download, FileDown, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { tabel as semuaTabel } from '@/data/tabel'
import { BelumAdaData } from '@/components/belum-ada-data'
import { Konfirmasi } from '@/components/konfirmasi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DataDashboard } from '@/hooks/use-data'
import { buatCadangan, gantiSemuaBaris, hapusBaris, simpanBaris, tambahRiwayat } from '@/lib/db'
import { bacaCsv, formatCsv, periksaBaris, rapikanBaris } from '@/lib/periksa'
import type { Baris, Tabel } from '@/lib/types'
import { cn, tanggalRamah, unduhFile } from '@/lib/utils'

// The main storage: every table of the business, on this computer.

export function Data({ data, muat }: { data: DataDashboard; muat: () => Promise<void> }) {
  const [aktif, setAktif] = useState(semuaTabel[0]?.id)
  const t = semuaTabel.find((x) => x.id === aktif) ?? semuaTabel[0]

  async function cadangan() {
    unduhFile(`cadangan-dashboard-otomasi-${new Date().toISOString().slice(0, 10)}.json`, await buatCadangan())
    await tambahRiwayat({ jenis: 'cadangan', ringkas: 'Cadangan dibuat dan diunduh' })
    await muat()
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Data usaha</CardTitle>
          <CardDescription className="text-base">
            Semua data tersimpan di komputer ini dan menjadi sumber utama. Halaman web yang tersambung hanya dibaca atau diisi dari
            sini. Buat cadangan seminggu sekali.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="lg" className="h-12 text-base" onClick={cadangan} disabled={!semuaTabel.length}>
            <Download /> Buat cadangan
          </Button>
          {semuaTabel.length > 1 &&
            semuaTabel.map((x) => (
              <Button
                key={x.id}
                variant={x.id === t?.id ? 'secondary' : 'ghost'}
                aria-pressed={x.id === t?.id}
                className="h-12 text-base"
                onClick={() => setAktif(x.id)}
              >
                {x.nama} <span className="text-muted-foreground">({data.baris[x.id]?.length ?? 0})</span>
              </Button>
            ))}
        </CardContent>
      </Card>

      {t ? (
        <IsiTabel key={t.id} tabel={t} baris={data.baris[t.id] ?? []} muat={muat} onCadangan={cadangan} />
      ) : (
        <Card>
          <CardContent>
            <BelumAdaData
              ikon={Database}
              judul="Belum ada tabel data"
              isi="Tabel dibuat agent-mu dari contoh datamu sendiri: file Excel atau CSV, foto buku catatan, atau screenshot. Belum punya catatan? Agent memberi rekomendasi kolom untuk kamu setujui dulu."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function IsiTabel({ tabel, baris, muat, onCadangan }: { tabel: Tabel; baris: Baris[]; muat: () => Promise<void>; onCadangan: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [impor, setImpor] = useState<{ baris: Baris[]; nama: string } | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [ubah, setUbah] = useState<Baris | 'baru' | null>(null)

  async function simpanImpor() {
    if (!impor) return
    await gantiSemuaBaris(tabel, impor.baris)
    await tambahRiwayat({ jenis: 'impor', ringkas: `Impor ${impor.baris.length} baris ${tabel.nama} dari ${impor.nama}` })
    setImpor(null)
    await muat()
  }

  async function pilihFile(f: File | undefined) {
    setGalat(null)
    if (!f) return
    try {
      setImpor({ baris: bacaCsv(await f.text(), tabel), nama: f.name })
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const tombolImpor = (
    <Button size="lg" variant="outline" className="h-12 text-base" onClick={() => fileRef.current?.click()}>
      <Upload /> Impor dari file CSV
    </Button>
  )
  const tombolTambah = (
    <Button size="lg" className="h-12 text-base" onClick={() => setUbah('baru')}>
      <Plus /> Tambah baris
    </Button>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{tabel.nama}</CardTitle>
        <CardDescription className="text-base">
          {baris.length} baris · Kolom disusun dari: {tabel.asal}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {tombolTambah}
          {tombolImpor}
          <Button size="lg" variant="ghost" className="h-12 text-base" onClick={() => unduhFile(`format-${tabel.id}.csv`, formatCsv(tabel), 'text/csv')}>
            <FileDown /> Unduh format CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => pilihFile(e.target.files?.[0])} />
        </div>

        {galat && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-base">
            File belum bisa dibaca: {galat}
          </p>
        )}
        {impor && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="text-base">
              <b>{impor.nama}</b> berisi {impor.baris.length} baris.{' '}
              {baris.length > 0 ? (
                <>
                  Impor akan <b>mengganti</b> {baris.length} baris {tabel.nama} yang ada sekarang.
                </>
              ) : (
                <>{tabel.nama} masih kosong, jadi tidak ada data yang tertimpa.</>
              )}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {baris.length > 0 ? (
                <Konfirmasi
                  pemicu={<Button className="h-11 text-base">Ganti dengan isi file</Button>}
                  judul={`Ganti ${baris.length} baris ${tabel.nama}?`}
                  isi="Data sekarang akan diganti isi file. Sebaiknya buat cadangan dulu, supaya bisa dikembalikan."
                  tombolYa="Ya, ganti"
                  bahaya
                  onYa={simpanImpor}
                />
              ) : (
                <Button className="h-11 text-base" onClick={simpanImpor}>
                  Impor {impor.baris.length} baris
                </Button>
              )}
              {baris.length > 0 && (
                <Button variant="outline" className="h-11 text-base" onClick={onCadangan}>
                  Buat cadangan dulu
                </Button>
              )}
              <Button variant="ghost" className="h-11 text-base" onClick={() => setImpor(null)}>
                Batal
              </Button>
            </div>
          </div>
        )}

        {ubah && (
          <FormBaris
            tabel={tabel}
            awal={ubah === 'baru' ? undefined : ubah}
            kunciAda={(k) => baris.some((b) => String(b[tabel.kunci]) === k)}
            onBatal={() => setUbah(null)}
            onSimpan={async (b) => {
              await simpanBaris(tabel, [b])
              await tambahRiwayat({
                jenis: 'data',
                ringkas: `${tabel.nama} ${String(b[tabel.kunci])} ${ubah === 'baru' ? 'ditambahkan' : 'diubah'} manual`,
              })
              setUbah(null)
              await muat()
            }}
          />
        )}

        {baris.length === 0 ? (
          <BelumAdaData
            judul={`${tabel.nama} masih kosong`}
            isi={
              <>
                Isi dengan datamu sendiri: unduh format CSV, isi di spreadsheet, lalu impor. Atau tekan <b>Tambah baris</b>.
              </>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  {tabel.kolom.map((k) => (
                    <TableHead key={k.id} className={cn(k.jenis === 'angka' && 'text-right')}>
                      {k.label}
                    </TableHead>
                  ))}
                  <TableHead className="sr-only">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baris.map((b) => {
                  const kunci = String(b[tabel.kunci])
                  return (
                    <TableRow key={kunci}>
                      {tabel.kolom.map((k) => (
                        <TableCell key={k.id} className={cn(k.jenis === 'angka' && 'text-right tabular-nums', k.id === tabel.kunci && 'font-medium')}>
                          {k.jenis === 'tanggal' && b[k.id] ? tanggalRamah(String(b[k.id])) : (b[k.id] ?? '')}
                        </TableCell>
                      ))}
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" aria-label={`Ubah ${kunci}`} onClick={() => setUbah(b)}>
                          <Pencil />
                        </Button>
                        <Konfirmasi
                          pemicu={
                            <Button size="icon" variant="ghost" aria-label={`Hapus ${kunci}`}>
                              <Trash2 />
                            </Button>
                          }
                          judul={`Hapus ${kunci}?`}
                          isi="Baris ini dihapus dari komputer ini. Hanya bisa dikembalikan dari file cadangan."
                          tombolYa="Ya, hapus"
                          bahaya
                          onYa={async () => {
                            await hapusBaris(tabel.id, kunci)
                            await tambahRiwayat({ jenis: 'data', ringkas: `${tabel.nama} ${kunci} dihapus` })
                            await muat()
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FormBaris({
  tabel,
  awal,
  kunciAda,
  onSimpan,
  onBatal,
}: {
  tabel: Tabel
  awal?: Baris
  kunciAda: (k: string) => boolean
  onSimpan: (b: Baris) => Promise<void>
  onBatal: () => void
}) {
  const [isi, setIsi] = useState<Record<string, string>>(() =>
    Object.fromEntries(tabel.kolom.map((k) => [k.id, awal?.[k.id] === undefined ? '' : String(awal[k.id])])),
  )
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    const salah = periksaBaris(tabel, isi)
    if (salah) return setGalat(salah)
    if (!awal && kunciAda(isi[tabel.kunci].trim())) return setGalat(`"${isi[tabel.kunci]}" sudah ada. Pakai tombol ubah di barisnya.`)
    await onSimpan(rapikanBaris(tabel, isi))
  }

  return (
    <form onSubmit={kirim} className="flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-base font-semibold">{awal ? `Ubah ${String(awal[tabel.kunci])}` : `Tambah baris ${tabel.nama}`}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tabel.kolom.map((k) => {
          const id = `isi-${k.id}`
          const ubah = (v: string) => setIsi((s) => ({ ...s, [k.id]: v }))
          return (
            <div key={k.id} className="flex flex-col gap-2">
              <Label htmlFor={id} className="text-base">
                {k.label}
                {(k.wajib || k.id === tabel.kunci) && <span className="text-muted-foreground"> (wajib)</span>}
              </Label>
              {k.jenis === 'pilihan' && k.pilihan ? (
                <select
                  id={id}
                  value={isi[k.id]}
                  onChange={(e) => ubah(e.target.value)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="">Pilih…</option>
                  {k.pilihan.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id}
                  value={isi[k.id]}
                  onChange={(e) => ubah(e.target.value)}
                  type={k.jenis === 'tanggal' ? 'date' : 'text'}
                  inputMode={k.jenis === 'angka' ? 'decimal' : undefined}
                  disabled={!!awal && k.id === tabel.kunci}
                  className="h-11 text-base"
                />
              )}
            </div>
          )
        })}
      </div>
      {galat && (
        <p role="alert" className="text-base text-destructive">
          {galat}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-11 text-base">
          Simpan
        </Button>
        <Button type="button" variant="ghost" className="h-11 text-base" onClick={onBatal}>
          Batal
        </Button>
      </div>
    </form>
  )
}
