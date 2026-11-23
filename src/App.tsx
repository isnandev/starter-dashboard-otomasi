import { useEffect, useState } from 'react'
import { Building2, Database, History, House, Loader2, Plug, Settings } from 'lucide-react'
import { useData } from '@/hooks/use-data'
import { Beranda } from '@/pages/beranda'
import { Data } from '@/pages/data'
import { Pengaturan } from '@/pages/pengaturan'
import { Riwayat } from '@/pages/riwayat'
import { Sambungan } from '@/pages/sambungan'
import { cn } from '@/lib/utils'

// Few screens on purpose. Data = the main storage; Sambungan = the bridges to web pages.
const HALAMAN = [
  { id: 'beranda', label: 'Beranda', ikon: House },
  { id: 'data', label: 'Data', ikon: Database },
  { id: 'sambungan', label: 'Sambungan', ikon: Plug },
  { id: 'riwayat', label: 'Riwayat', ikon: History },
  { id: 'pengaturan', label: 'Pengaturan', ikon: Settings },
] as const

export type IdHalaman = (typeof HALAMAN)[number]['id']

export default function App() {
  const { data, muat } = useData()
  const [halaman, setHalaman] = useState<IdHalaman>('beranda')

  // Theme: light, dark, or follow the computer.
  const tema = data?.pengaturan.tema ?? 'sistem'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const terapkan = () =>
      document.documentElement.classList.toggle('dark', tema === 'gelap' || (tema === 'sistem' && media.matches))
    terapkan()
    media.addEventListener('change', terapkan)
    return () => media.removeEventListener('change', terapkan)
  }, [tema])

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-lg text-muted-foreground">
        <Loader2 className="animate-spin" /> Memuat dashboard…
      </div>
    )
  }

  const namaUsaha = data.pengaturan.namaUsaha.trim()

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground" aria-hidden>
              {namaUsaha ? namaUsaha.charAt(0).toUpperCase() : <Building2 className="size-5" />}
            </div>
            <div>
              {namaUsaha ? (
                <p className="text-lg font-semibold leading-tight">{namaUsaha}</p>
              ) : (
                <button onClick={() => setHalaman('pengaturan')} className="text-lg font-semibold leading-tight text-muted-foreground underline-offset-4 hover:underline">
                  Nama usaha belum diisi
                </button>
              )}
              <p className="text-sm text-muted-foreground">Dashboard otomasi</p>
            </div>
          </div>
          <nav aria-label="Halaman" className="flex gap-1 overflow-x-auto">
            {HALAMAN.map((h) => (
              <button
                key={h.id}
                onClick={() => setHalaman(h.id)}
                aria-current={halaman === h.id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-base font-medium whitespace-nowrap transition-colors',
                  halaman === h.id ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <h.ikon className="size-4" aria-hidden />
                {h.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {halaman === 'beranda' && <Beranda data={data} muat={muat} keHalaman={setHalaman} />}
        {halaman === 'data' && <Data data={data} muat={muat} />}
        {halaman === 'sambungan' && <Sambungan data={data} muat={muat} />}
        {halaman === 'riwayat' && <Riwayat data={data} />}
        {halaman === 'pengaturan' && <Pengaturan data={data} muat={muat} />}
      </main>
    </div>
  )
}
