import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** True when the page runs inside the installed Chrome extension. */
export const diExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id

const fmtJam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' })
const fmtTanggal = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' })

/** "Hari ini 10.15", "Kemarin 21.03", "12 Nov 08.00". */
export function waktuRamah(ms?: number): string {
  if (!ms) return 'belum pernah'
  const d = new Date(ms)
  const hariIni = new Date()
  const kemarin = new Date(Date.now() - 86_400_000)
  const sama = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const jam = fmtJam.format(d)
  if (sama(d, hariIni)) return `Hari ini ${jam}`
  if (sama(d, kemarin)) return `Kemarin ${jam}`
  return `${fmtTanggal.format(d)} ${jam}`
}

/** "dalam 12 menit", "sekarang". */
export function nantiRamah(ms?: number): string {
  if (!ms) return '-'
  const menit = Math.round((ms - Date.now()) / 60_000)
  if (menit <= 0) return 'sebentar lagi'
  if (menit < 60) return `dalam ${menit} menit`
  return `dalam ${Math.round(menit / 60)} jam`
}

export function unduhFile(namaFile: string, isi: string, tipe = 'application/json') {
  const url = URL.createObjectURL(new Blob([isi], { type: tipe }))
  const a = document.createElement('a')
  a.href = url
  a.download = namaFile
  a.click()
  URL.revokeObjectURL(url)
}

/** Fills "{kolom}" placeholders from one row: isiTemplate('Halo {nama}', baris). No AI. */
export function isiTemplate(teks: string, baris: Record<string, string | number>): string {
  return teks.replace(/\{(\w+)\}/g, (_, k: string) => String(baris[k] ?? ''))
}

const fmtTanggalPanjang = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "2026-11-20" → "20 Nov 2026". */
export function tanggalRamah(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : fmtTanggalPanjang.format(d)
}
