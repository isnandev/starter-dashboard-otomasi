import { useState } from 'react'
import { Check, CircleCheck, ClipboardCopy, FlaskConical, Loader2, OctagonX, Play, RefreshCw, Workflow } from 'lucide-react'
import type { IdHalaman } from '@/App'
import { tabel } from '@/data/tabel'
import { otomasi } from '@/otomasi'
import { sambungan } from '@/sambungan'
import { BelumAdaData } from '@/components/belum-ada-data'
import { Konfirmasi } from '@/components/konfirmasi'
import { StatusBanner } from '@/components/status-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import type { DataDashboard } from '@/hooks/use-data'
import { simpan, tambahRiwayat, ubahPengaturan } from '@/lib/db'
import { jalankan } from '@/lib/mesin'
import { tesSambungan } from '@/lib/sambungan'
import type { HasilJalan } from '@/lib/types'
import { cn, diExtension, nantiRamah, waktuRamah } from '@/lib/utils'

export function Beranda({ data, muat, keHalaman }: { data: DataDashboard; muat: () => Promise<void>; keHalaman: (h: IdHalaman) => void }) {
  const [sibuk, setSibuk] = useState<null | 'uji' | 'jalan'>(null)
  const [disalin, setDisalin] = useState<string | null>(null)
  const set = data.pengaturan
  const ujiLulus = !!data.hasilUji && data.hasilUji.otomasi.every((o) => o.berhasil)

  async function jalan(uji: boolean) {
    setSibuk(uji ? 'uji' : 'jalan')
    try {
      await jalankan({ uji })
      if (!uji && !set.panduanSelesai) await ubahPengaturan({ panduanSelesai: true })
    } finally {
      setSibuk(null)
      await muat()
    }
  }

  async function cobaLagi() {
    setSibuk('uji')
    try {
      for (const s of sambungan) if (data.sambungan[s.id]?.keadaan === 'gagal') await tesSambungan(s)
      if (otomasi.length) await jalankan({ uji: true })
    } finally {
      setSibuk(null)
      await muat()
    }
  }

  async function aturJeda(jeda: boolean) {
    await ubahPengaturan({ jeda })
    await tambahRiwayat({ jenis: 'pengaturan', ringkas: jeda ? 'Semua otomasi dijeda' : 'Otomasi dinyalakan lagi' })
    if (diExtension) chrome.runtime.sendMessage({ jenis: 'jadwal-ulang' }).catch(() => {})
    await muat()
  }

  async function salin(teks: string, id: string) {
    await navigator.clipboard.writeText(teks)
    setDisalin(id)
    setTimeout(() => setDisalin(null), 2000)
  }

  async function selesaiAlarm(kunci: string) {
    const a = data.alarm.find((x) => x.kunci === kunci)
    await simpan('alarm', data.alarm.filter((x) => x.kunci !== kunci))
    await tambahRiwayat({ jenis: 'alarm', ringkas: `Ditandai selesai: ${a?.pesan ?? kunci}` })
    await muat()
  }

  async function selesaiDraf(id: string) {
    const d = data.perluDicek.find((x) => x.id === id)
    await simpan('perlu-dicek', data.perluDicek.filter((x) => x.id !== id))
    await tambahRiwayat({ jenis: 'data', ringkas: `Draf selesai dicek: ${d?.judul ?? id}` })
    await muat()
  }

  const tombolCobaLagi = data.status.tingkat === 'berhenti' && !set.jeda && (
    <Button size="lg" className="h-12 text-base" onClick={cobaLagi} disabled={!!sibuk}>
      {sibuk ? <Loader2 className="animate-spin" /> : <RefreshCw />} Coba lagi
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={data.status} aksi={tombolCobaLagi} />

      {!set.panduanSelesai && <PanduanAwal data={data} keHalaman={keHalaman} onUji={() => jalan(true)} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Otomasi</CardTitle>
          <CardDescription className="text-base">
            {otomasi.length ? `${otomasi.length} otomasi dari rancanganmu.` : 'Otomasi dari rancanganmu muncul di sini.'}
            {data.jalanBerikutnya && !set.jeda && otomasi.some((o) => o.terjadwal) && (
              <> Jalan otomatis berikutnya {nantiRamah(data.jalanBerikutnya)}.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {otomasi.length === 0 ? (
            <BelumAdaData
              ikon={Workflow}
              judul="Belum ada otomasi"
              isi="Agent-mu membangun otomasi dari rancangan, setelah tabel data terisi dan setiap sambungan terbukti."
            />
          ) : (
            <>
              <ul className="flex flex-col divide-y rounded-lg border">
                {otomasi.map((o) => (
                  <li key={o.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex-1">
                      <p className="text-base font-semibold">{o.nama}</p>
                      <p className="text-sm text-muted-foreground">{o.keterangan}</p>
                    </div>
                    <Badge variant="outline" className="w-fit text-sm">
                      {o.terjadwal ? `Tiap ${set.intervalMenit} menit` : 'Dari tombol saja'}
                    </Badge>
                  </li>
                ))}
              </ul>
              {set.modeUji && (
                <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
                  <FlaskConical className="size-6 shrink-0 text-warning" aria-hidden />
                  <p className="flex-1 text-base">
                    <b>Mode uji aktif.</b> Otomasi hanya mencatat apa yang akan dilakukan, tanpa mengubah apa pun.
                    {!ujiLulus && <> "Mulai jalan sungguhan" aktif setelah <b>Coba dulu</b> berhasil tanpa galat.</>}
                  </p>
                  <Konfirmasi
                    pemicu={
                      <Button variant="outline" className="h-11 text-base" disabled={!ujiLulus}>
                        Mulai jalan sungguhan
                      </Button>
                    }
                    judul="Mulai jalan sungguhan?"
                    isi="Setelah ini, otomasi benar-benar menyimpan data dan mengubah halaman yang tersambung. Pastikan hasil uji coba terakhir sudah sesuai."
                    tombolYa="Ya, mulai"
                    onYa={async () => {
                      await ubahPengaturan({ modeUji: false })
                      await tambahRiwayat({ jenis: 'pengaturan', ringkas: 'Mode uji dimatikan: otomasi sekarang mengubah data sungguhan' })
                      await muat()
                    }}
                  />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button size="lg" variant="outline" className="h-14 text-base" onClick={() => jalan(true)} disabled={!!sibuk}>
                  {sibuk === 'uji' ? <Loader2 className="animate-spin" /> : <FlaskConical />}
                  Coba dulu (tidak mengubah apa pun)
                </Button>
                <Button size="lg" className="h-14 text-base" onClick={() => jalan(false)} disabled={!!sibuk || set.modeUji || set.jeda}>
                  {sibuk === 'jalan' ? <Loader2 className="animate-spin" /> : <Play />}
                  Jalankan sekarang
                </Button>
              </div>
              {(set.modeUji || set.jeda) && (
                <p className="text-sm text-muted-foreground">
                  "Jalankan sekarang" aktif setelah {set.jeda ? 'otomasi tidak dijeda' : 'mode uji dimatikan'}.
                </p>
              )}
            </>
          )}
          <label className="flex items-center justify-between gap-4 rounded-lg border p-4">
            <span>
              <span className="block text-base font-medium">Jeda semua otomasi</span>
              <span className="block text-sm text-muted-foreground">Menghentikan jadwal otomatis sampai kamu nyalakan lagi.</span>
            </span>
            <Switch checked={set.jeda} onCheckedChange={aturJeda} className="scale-125" />
          </label>
          <HasilTerakhir hasil={[data.hasilUji, data.hasilTerakhir].filter((h): h is HasilJalan => !!h).sort((a, b) => b.waktu - a.waktu)[0]} />
        </CardContent>
      </Card>

      {data.alarm.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Perlu perhatian</h2>
          <Card>
            <CardContent className="divide-y">
              {data.alarm.map((a) => (
                <div key={a.kunci} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                  <p className="flex-1 text-base">{a.pesan}</p>
                  <Button variant="outline" className="h-10" onClick={() => selesaiAlarm(a.kunci)}>
                    <Check /> Tandai selesai
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {data.perluDicek.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Perlu dicek</h2>
          <p className="text-base text-muted-foreground">Draf ini tidak pernah dikirim otomatis. Baca, ubah kalau perlu, lalu pakai sendiri.</p>
          <Card>
            <CardContent className="divide-y">
              {data.perluDicek.map((d) => (
                <div key={d.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <p className="text-base font-semibold">{d.judul}</p>
                  <p className="rounded-lg bg-muted p-3 text-base whitespace-pre-wrap">{d.isi}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="h-10" onClick={() => salin(d.isi, d.id)}>
                      {disalin === d.id ? <Check /> : <ClipboardCopy />}
                      {disalin === d.id ? 'Draf disalin' : 'Salin draf'}
                    </Button>
                    <Button variant="ghost" className="h-10" onClick={() => selesaiDraf(d.id)}>
                      Selesai dicek
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  )
}

function HasilTerakhir({ hasil }: { hasil?: HasilJalan }) {
  if (!hasil) return null
  return (
    <div className="rounded-lg bg-muted p-4">
      <p className="text-base font-medium">
        {hasil.uji ? 'Hasil uji coba' : 'Hasil terakhir'} · {waktuRamah(hasil.waktu)}
      </p>
      <ul className="mt-2 flex flex-col gap-3">
        {hasil.otomasi.map((o) => (
          <li key={o.id} className="flex gap-3">
            {o.berhasil ? (
              <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="berhasil" />
            ) : (
              <OctagonX className="mt-0.5 size-5 shrink-0 text-destructive" aria-label="gagal" />
            )}
            <div>
              <p className="text-base">
                <b>{o.nama}:</b> {o.ringkas}
              </p>
              {o.detail.length > 0 && (
                <ul className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {o.detail.slice(0, 6).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                  {o.detail.length > 6 && <li>dan {o.detail.length - 6} lainnya (lihat Riwayat)</li>}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PanduanAwal({ data, keHalaman, onUji }: { data: DataDashboard; keHalaman: (h: IdHalaman) => void; onUji: () => void }) {
  const dataTerisi = tabel.length > 0 && tabel.every((t) => (data.baris[t.id]?.length ?? 0) > 0)
  const sambunganTerbukti = sambungan.length > 0 && sambungan.every((s) => data.sambungan[s.id]?.keadaan === 'terbukti')
  const langkah = [
    tabel.length === 0
      ? { judul: 'Siapkan data', isi: 'Kirim contoh datamu ke agent. Agent menyusun tabel dari contoh itu.', selesai: false }
      : { judul: 'Isi data', isi: 'Impor atau ketik datamu di halaman Data.', selesai: dataTerisi, aksi: () => keHalaman('data'), tombol: 'Buka halaman Data' },
    {
      judul: 'Buktikan sambungan',
      isi:
        sambungan.length === 0
          ? 'Survei halaman web yang mau disambungkan, lalu kirim hasilnya ke agent.'
          : 'Buka halamannya, login, lalu tekan Tes sambungan sampai terbukti.',
      selesai: sambunganTerbukti,
      aksi: () => keHalaman('sambungan'),
      tombol: 'Buka Sambungan',
    },
    {
      judul: 'Coba dulu',
      isi: 'Lihat apa yang akan dilakukan otomasi, tanpa mengubah apa pun.',
      selesai: !!data.hasilUji && data.hasilUji.otomasi.every((o) => o.berhasil),
      aksi: otomasi.length ? onUji : undefined,
      tombol: 'Coba dulu',
    },
  ]
  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="text-xl">Mulai di sini: 3 langkah</CardTitle>
        <CardDescription className="text-base">Data dulu, lalu sambungan yang terbukti, lalu uji coba.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3">
          {langkah.map((l, i) => (
            <li key={l.judul} className="flex flex-wrap items-center gap-4 rounded-lg border p-4">
              <span
                className={cn('flex size-9 shrink-0 items-center justify-center rounded-full text-base font-semibold', l.selesai ? 'bg-success text-white' : 'bg-muted')}
                aria-label={l.selesai ? 'selesai' : `langkah ${i + 1}`}
              >
                {l.selesai ? <Check className="size-5" /> : i + 1}
              </span>
              <div className="min-w-48 flex-1">
                <p className="text-base font-semibold">{l.judul}</p>
                <p className="text-sm text-muted-foreground">{l.isi}</p>
              </div>
              {'tombol' in l && l.tombol && (
                <Button variant={l.selesai ? 'ghost' : 'outline'} className="h-10 w-full sm:w-auto" onClick={l.aksi} disabled={!l.aksi}>
                  {l.tombol}
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
