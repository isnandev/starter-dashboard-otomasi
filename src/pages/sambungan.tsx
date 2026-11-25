import { useEffect, useState } from 'react'
import { Check, ClipboardCopy, ExternalLink, Loader2, Plug, RefreshCw, ScanSearch } from 'lucide-react'
import { sambungan } from '@/sambungan'
import { BelumAdaData } from '@/components/belum-ada-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DataDashboard } from '@/hooks/use-data'
import { laporanBukti, tesSambungan } from '@/lib/sambungan'
import { jalankanSurvei, laporanSurvei, mintaIzin, ringkasSurvei } from '@/lib/survei'
import type { KeadaanSambungan } from '@/lib/types'
import { cn, diExtension, waktuRamah } from '@/lib/utils'

const LABEL: Record<KeadaanSambungan, string> = { terbukti: 'Terbukti tersambung', 'belum-dicoba': 'Belum dites', gagal: 'Belum tersambung' }

export function Sambungan({ data, muat }: { data: DataDashboard; muat: () => Promise<void> }) {
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [disalin, setDisalin] = useState<string | null>(null)

  async function salin(teks: string, id: string) {
    await navigator.clipboard.writeText(teks)
    setDisalin(id)
    setTimeout(() => setDisalin(null), 2000)
  }

  async function tes(id: string) {
    setSibuk(id)
    try {
      await tesSambungan(sambungan.find((s) => s.id === id)!)
    } finally {
      setSibuk(null)
      await muat()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Sambungan</h2>
        <p className="text-base text-muted-foreground">
          Jembatan antara datamu dan halaman web yang kamu buka di Chrome. Sebuah sambungan baru dianggap tersambung kalau data asli
          benar-benar terbaca dari halamannya. Bandingkan contoh barisnya dengan yang kamu lihat di halaman.
        </p>
        {sambungan.length === 0 && (
          <BelumAdaData
            ikon={Plug}
            judul="Belum ada sambungan"
            isi="Sambungan dibuat agent-mu dari hasil survei halaman web di bawah, bukan dari tebakan."
          />
        )}
        {sambungan.map((s) => {
          const st = data.sambungan[s.id]
          const keadaan: KeadaanSambungan = st?.keadaan ?? 'belum-dicoba'
          return (
            <Card key={s.id} className={cn(keadaan === 'gagal' && 'border-destructive/50')}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <Plug className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
                  <p className="flex-1 text-base font-semibold leading-snug">{s.nama}</p>
                  <Badge
                    variant={keadaan === 'gagal' ? 'destructive' : 'outline'}
                    className={cn('text-sm', keadaan === 'terbukti' && 'border-success/40 text-success')}
                  >
                    {LABEL[keadaan]}
                  </Badge>
                </div>
                {st && (
                  <p className="text-base">
                    {st.pesan} <span className="text-muted-foreground">· {waktuRamah(st.waktu)}</span>
                  </p>
                )}
                {st?.saran && <p className="text-sm text-muted-foreground">{st.saran}</p>}
                {keadaan === 'belum-dicoba' && (
                  <p className="text-sm text-muted-foreground">Buka halamannya dan login, lalu tekan Tes sambungan.</p>
                )}
                {st?.bukti && st.bukti.contoh.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border">
                    <p className="px-3 pt-2 text-sm text-muted-foreground">Contoh yang terbaca dari {st.bukti.halaman}:</p>
                    <Table className="text-sm">
                      <TableHeader>
                        <TableRow>
                          {s.kolom.map((k) => (
                            <TableHead key={k.id}>{k.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {st.bukti.contoh.map((b, i) => (
                          <TableRow key={i}>
                            {s.kolom.map((k) => (
                              <TableCell key={k.id}>{b[k.id] ?? ''}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button className="h-10" onClick={() => tes(s.id)} disabled={!!sibuk || !diExtension}>
                    {sibuk === s.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tes sambungan
                  </Button>
                  <Button variant="outline" className="h-10" onClick={() => window.open(s.halaman, '_blank')} disabled={!s.halaman}>
                    <ExternalLink /> Buka halaman
                  </Button>
                  {st?.bukti && (
                    <Button variant="ghost" className="h-10" onClick={() => salin(laporanBukti(s, st.bukti!), `bukti-${s.id}`)}>
                      {disalin === `bukti-${s.id}` ? <Check /> : <ClipboardCopy />}
                      {disalin === `bukti-${s.id}` ? 'Bukti disalin' : 'Salin bukti untuk agent'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Survei data={data} muat={muat} salin={salin} disalin={disalin} />
    </div>
  )
}

function Survei({
  data,
  muat,
  salin,
  disalin,
}: {
  data: DataDashboard
  muat: () => Promise<void>
  salin: (teks: string, id: string) => void
  disalin: string | null
}) {
  const [tab, setTab] = useState<chrome.tabs.Tab[]>([])
  const [sibuk, setSibuk] = useState<number | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [asli, setAsli] = useState(false)

  async function muatTab() {
    if (!diExtension) return
    const semua = await chrome.tabs.query({})
    setTab(semua.filter((t) => /^https?:/.test(t.url ?? '')))
  }
  useEffect(() => {
    muatTab()
  }, [])

  function survei(t: chrome.tabs.Tab) {
    setGalat(null)
    setSibuk(t.id ?? null)
    // The permission prompt must start straight from the click.
    mintaIzin(t.url!)
      .then(async (boleh) => {
        if (!boleh) throw new Error('Izin tidak diberikan. Survei perlu izin membaca halaman itu.')
        await jalankanSurvei(t)
      })
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)))
      .finally(async () => {
        setSibuk(null)
        await muat()
      })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Survei halaman web</CardTitle>
        <CardDescription className="text-base">
          Sebelum agent membuat sambungan, survei dulu halaman yang mau disambungkan: buka halamannya di Chrome dan login, lalu tekan{' '}
          <b>Survei halaman ini</b>. Salin hasilnya ke agent, supaya agent membangun dari halaman yang asli, bukan tebakan.
        </CardDescription>
        <CardDescription className="text-base">
          Supaya yang disurvei hanya daftar yang mau disambungkan: di halaman itu, <b>sorot (blok) sedikit teks dari dua baris daftarnya</b>,
          lalu tekan Survei. Tanpa sorotan, yang disurvei jendela yang terbuka atau bagian utama halaman, bukan daftar di samping (misalnya
          daftar chat).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!diExtension ? (
          <p className="text-base text-muted-foreground">Survei hanya bisa dari extension yang sudah terpasang di Chrome.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-medium">Tab yang terbuka</p>
              <Button variant="ghost" className="h-10" onClick={muatTab}>
                <RefreshCw /> Muat ulang daftar
              </Button>
            </div>
            {tab.length === 0 ? (
              <p className="text-base text-muted-foreground">Belum ada halaman web yang terbuka. Buka halamannya di tab lain, lalu muat ulang daftar.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border">
                {tab.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base">{t.title}</p>
                      <p className="truncate text-sm text-muted-foreground">{new URL(t.url!).host + new URL(t.url!).pathname}</p>
                    </div>
                    <Button variant="outline" className="h-10" onClick={() => survei(t)} disabled={sibuk !== null}>
                      {sibuk === t.id ? <Loader2 className="animate-spin" /> : <ScanSearch />} Survei halaman ini
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {galat && (
          <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-base">
            Survei belum berhasil: {galat}
          </p>
        )}

        {data.survei.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-base font-medium">Hasil survei</p>
            <p className="text-sm text-muted-foreground">
              Berisi struktur halaman dan paling banyak 3 contoh baris dari halamannya. Kata sandi tidak pernah dibaca. Yang disalin untuk
              agent <b>sudah disensor</b>: nomor HP dan email diganti, nama dan isi chat jadi huruf depannya saja. Tetap periksa dulu sebelum
              menempelnya ke agent.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 size-4" checked={asli} onChange={(e) => setAsli(e.target.checked)} />
              <span>Salin teks contoh apa adanya (tanpa sensor). Hanya untuk halaman tanpa data pelanggan, misalnya daftar produk.</span>
            </label>
            {data.survei.map((h) => (
              <div key={h.halaman} className="flex flex-col gap-2 rounded-lg border p-3">
                <p className="text-base font-semibold">{h.judul || h.halaman}</p>
                <p className="text-sm text-muted-foreground">
                  {h.halaman} · {waktuRamah(h.waktu)}
                </p>
                <p className="text-sm">{ringkasSurvei(h)}</p>
                {h.bagian && <p className="text-sm text-muted-foreground">Yang disurvei: {h.bagian}</p>}
                {h.tabel.map((t, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    Tabel {i + 1}: {t.kolom.filter(Boolean).join(' · ') || '(tanpa judul kolom)'} ({t.jumlahBaris} baris)
                  </p>
                ))}
                <Button variant="outline" className="h-10 w-fit" onClick={() => salin(laporanSurvei(h, { asli }), `survei-${h.halaman}`)}>
                  {disalin === `survei-${h.halaman}` ? <Check /> : <ClipboardCopy />}
                  {disalin === `survei-${h.halaman}` ? 'Hasil survei disalin' : 'Salin hasil survei untuk agent'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
