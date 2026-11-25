import type { KolomSambungan } from './periksa'
import type { HasilSurvei } from './survei'
import type { Baris } from './types'

// Sensor: what the owner copies to the agent (survey, bukti, laporan) goes to
// a cloud AI. Customer names, phone numbers, addresses and chat text must not
// go with it. The dashboard itself keeps and shows the real values (they stay
// on this computer); only the copies "untuk agent" are censored, by default.
//
// Two levels:
// - sensorTeks: phone numbers, e-mail addresses and long numbers (NIK, bank
//   accounts) become placeholders. Used on everything copied.
// - samarkanTeks: sensorTeks, then every word made of letters becomes its
//   first letter + "…" ("Bu Siti" → "B… S…"). Numbers, prices, dates, sizes
//   and codes stay, because the agent needs their format. Used on sample rows,
//   where names and messages live.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
// Indonesian mobile numbers (+62 / 62 / 0 then 8…), and any "+<country>" number.
const HP = /(?<![\w])(?:\+?62|0)[\s-]?8\d{1,3}(?:[\s.-]?\d{2,4}){2,4}(?![\w])|(?<![\w])\+\d{1,3}(?:[\s.-]?\d{2,4}){3,5}(?![\w])/g
// 10+ digits in a row (or in groups) that are not a price: NIK, rekening, IDs.
const ANGKA_PANJANG = /(?<![\w.,])\d(?:[\s-]?\d){9,}(?![\w.,])/g

export function sensorTeks(t: string): string {
  return t.replace(EMAIL, '[email]').replace(HP, '[nomor HP]').replace(ANGKA_PANJANG, '[angka panjang]')
}

/** Words of letters → first letter + "…". Words in `aman` (lowercase, e.g. column headers) stay. */
export function samarkanTeks(t: string, aman: Set<string> = new Set()): string {
  return sensorTeks(t)
    .split(/(\[[^\]]*\]|\s+)/)
    .map((kata) => {
      if (/^\s*$/.test(kata) || /^\[.*\]$/.test(kata) || /\d/.test(kata)) return kata
      const huruf = kata.replace(/[^\p{L}]/gu, '')
      if (huruf.length <= 1 || aman.has(huruf.toLowerCase())) return kata
      return kata.replace(/(\p{L})\p{L}+/gu, '$1…')
    })
    .join('')
}

const kataDari = (daftar: string[]) => new Set(daftar.flatMap((t) => t.toLowerCase().split(/[^\p{L}]+/u)).filter((k) => k.length > 1))

/** The survey as it may be copied to the agent: structure kept, sample text censored. */
export function sensorSurvei(h: HasilSurvei): HasilSurvei {
  // Column headers are page labels ("Stok", "Harga"), not customer data.
  const aman = kataDari(h.tabel.flatMap((t) => t.kolom))
  const samar = (t: string) => samarkanTeks(t, aman)
  return {
    ...h,
    judul: sensorTeks(h.judul),
    judulBagian: h.judulBagian.map(samar),
    tabel: h.tabel.map((t) => ({ ...t, kolom: t.kolom.map(sensorTeks), contoh: t.contoh.map((b) => b.map(samar)) })),
    daftar: h.daftar.map((d) => ({ ...d, contoh: d.contoh.map(samar) })),
    isian: h.isian.map((i) => ({ ...i, label: sensorTeks(i.label), penanda: sensorTeks(i.penanda), nilai: samar(i.nilai) })),
    tombol: h.tombol.map(samar),
    disensor: true,
  }
}

/**
 * Rows from a sambungan, as copied to the agent. Columns marked `aman` (no
 * personal data: product name, price, stock, status) keep their text; numbers
 * always stay; every other text column is samarkan'd.
 */
export function sensorBaris(baris: Baris[], kolom: KolomSambungan[]): Baris[] {
  const aman = new Set(kolom.filter((k) => k.aman).map((k) => k.id))
  return baris.map((b) =>
    Object.fromEntries(
      Object.entries(b).map(([id, v]) => {
        if (typeof v === 'number') return [id, Math.abs(v) >= 1e9 ? '[angka panjang]' : v]
        return [id, aman.has(id) ? sensorTeks(String(v)) : samarkanTeks(String(v))]
      }),
    ),
  )
}
