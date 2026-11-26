import type { KolomSambungan } from './periksa'
import type { HasilSurvei } from './survei'
import type { Baris, Nilai, Perubahan } from './types'

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
// Landlines: area code 02x–09xx, with or without brackets: "(021) 555 1234", "0341-551234".
const TELEPON = /(?<![\w])(?:\(0[2-9]\d{1,3}\)|0[2-9]\d{1,3})[\s.-]?\d{3,4}[\s.-]?\d{3,4}(?![\w])/g
// Candidates for long numbers (NIK, rekening, IDs): digits, maybe in groups
// split by spaces or dashes. Dots and commas are left out (prices: 12.500.000).
const ANGKA = /(?<![\w.,:/-])\d+(?:[\s-]\d+)*(?![\w.,:/])/g

/** A millisecond timestamp (2017–2049), e.g. Date.now(): not personal, keep it. */
const stempelWaktu = (digit: string) => /^\d{13}$/.test(digit) && Number(digit) >= 1.5e12 && Number(digit) < 2.5e12

function angkaPanjang(m: string): string {
  const digit = m.replace(/\D/g, '')
  if (digit.length < 10) return m
  // Short groups mean a date or a time ("2026-11-26 10"), not an ID.
  if (/[\s-]/.test(m) && m.split(/[\s-]+/).some((g) => g.length < 3)) return m
  if (stempelWaktu(digit)) return m
  return '[angka panjang]'
}

export function sensorTeks(t: string): string {
  return t.replace(EMAIL, '[email]').replace(HP, '[nomor HP]').replace(TELEPON, '[nomor telepon]').replace(ANGKA, angkaPanjang)
}

/** A number value from a row: long ones (IDs) are censored, prices, stock and timestamps stay. */
export function sensorAngka(v: number): number | string {
  return Math.abs(v) >= 1e9 && !stempelWaktu(String(Math.abs(v))) ? '[angka panjang]' : v
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

/**
 * The survey as it may be copied to the agent: structure kept, sample text censored.
 * The page's own UI text (headings, buttons, field labels, column headers) is
 * what the agent builds selectors from, so it only loses phone numbers,
 * e-mails and long numbers. Sample rows and field values are the data, so
 * they are samarkan'd.
 */
export function sensorSurvei(h: HasilSurvei): HasilSurvei {
  // Column headers and field labels are page labels ("Stok", "Harga"): keep those words inside
  // samples too. Buttons are left out on purpose: a chat page's header button can be a contact name.
  const aman = kataDari([...h.tabel.flatMap((t) => t.kolom), ...h.isian.map((i) => i.label)])
  const samar = (t: string) => samarkanTeks(t, aman)
  return {
    ...h,
    judul: sensorTeks(h.judul),
    judulBagian: h.judulBagian.map(sensorTeks),
    tabel: h.tabel.map((t) => ({ ...t, kolom: t.kolom.map(sensorTeks), contoh: t.contoh.map((b) => b.map(samar)) })),
    daftar: h.daftar.map((d) => ({ ...d, contoh: d.contoh.map(samar) })),
    isian: h.isian.map((i) => ({ ...i, label: sensorTeks(i.label), penanda: sensorTeks(i.penanda), nilai: samar(i.nilai) })),
    tombol: h.tombol.map(sensorTeks),
    disensor: true,
  }
}

/**
 * Changes (for a failure report) as copied to the agent: the row key, the
 * label and the values are censored like sample rows; a value keeps its text
 * only when its column is marked `aman`. Numbers stay.
 */
export function sensorPerubahan(perubahan: Perubahan[], kolom: KolomSambungan[], kunci: string): Perubahan[] {
  const aman = new Set(kolom.filter((k) => k.aman).map((k) => k.id))
  const nilai = (v: Nilai, id: string): Nilai => (typeof v === 'number' ? sensorAngka(v) : aman.has(id) ? sensorTeks(v) : samarkanTeks(v))
  return perubahan.map((p) => ({
    ...p,
    kunci: String(nilai(p.kunci, kunci)),
    ...(p.label !== undefined && { label: samarkanTeks(p.label) }),
    ...(p.dari !== undefined && p.dari !== null && { dari: nilai(p.dari, p.kolom) }),
    ke: nilai(p.ke, p.kolom),
  }))
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
        if (typeof v === 'number') return [id, sensorAngka(v)]
        return [id, aman.has(id) ? sensorTeks(String(v)) : samarkanTeks(String(v))]
      }),
    ),
  )
}
