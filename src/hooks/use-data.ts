import { useCallback, useEffect, useState } from 'react'
import { tabel } from '@/data/tabel'
import { ambil, pengaturan, riwayatTerbaru, semuaBaris } from '@/lib/db'
import { statusUmum } from '@/lib/mesin'
import { semuaStatusSambungan } from '@/lib/sambungan'
import { semuaSurvei, type HasilSurvei } from '@/lib/survei'
import type { Alarm, Baris, HasilJalan, Pengaturan, PerluDicek, Riwayat, StatusSambungan, StatusUmum } from '@/lib/types'
import { diExtension } from '@/lib/utils'

export interface DataDashboard {
  /** Rows per local table id. */
  baris: Record<string, Baris[]>
  riwayat: Riwayat[]
  pengaturan: Pengaturan
  status: StatusUmum
  sambungan: Record<string, StatusSambungan>
  survei: HasilSurvei[]
  hasilTerakhir: HasilJalan | null
  hasilUji: HasilJalan | null
  jalanBerikutnya: number | null
  alarm: Alarm[]
  perluDicek: PerluDicek[]
}

/** Loads everything the dashboard shows, and reloads when the background changes data. */
export function useData() {
  const [data, setData] = useState<DataDashboard | null>(null)

  const muat = useCallback(async () => {
    const [isi, riwayat, set, status, sambungan, survei, hasilTerakhir, hasilUji, berikut, alarm, perluDicek] = await Promise.all([
      Promise.all(tabel.map((t) => semuaBaris(t.id))),
      riwayatTerbaru(),
      pengaturan(),
      statusUmum(),
      semuaStatusSambungan(),
      semuaSurvei(),
      ambil<HasilJalan | null>('hasil-terakhir', null),
      ambil<HasilJalan | null>('hasil-uji', null),
      ambil<number | null>('jalan-berikutnya', null),
      ambil<Alarm[]>('alarm', []),
      ambil<PerluDicek[]>('perlu-dicek', []),
    ])
    const baris = Object.fromEntries(tabel.map((t, i) => [t.id, isi[i]]))
    setData({ baris, riwayat, pengaturan: set, status, sambungan, survei, hasilTerakhir, hasilUji, jalanBerikutnya: berikut, alarm, perluDicek })
  }, [])

  useEffect(() => {
    muat()
    const t = setInterval(muat, 30_000)
    const dengar = (pesan: { jenis?: string }) => {
      if (pesan?.jenis === 'data-berubah') muat()
    }
    if (diExtension) chrome.runtime.onMessage.addListener(dengar)
    return () => {
      clearInterval(t)
      if (diExtension) chrome.runtime.onMessage.removeListener(dengar)
    }
  }, [muat])

  return { data, muat }
}
