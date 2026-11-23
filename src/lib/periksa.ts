import type { Baris, Kolom, Nilai, Perubahan, Tabel } from './types'

// Pure checks, no browser APIs, so `npm run cek` can test them with Node.
// They turn "it seems to work" into "here is what was actually read".

/** "Rp 12.500" → 12500, "1.234" → 1234, "12,5" → 12.5. NaN when there is no number. */
export function keAngka(v: Nilai | undefined): number {
  if (typeof v === 'number') return v
  if (v === undefined) return NaN
  let s = String(v).replace(/[^\d.,-]/g, '')
  if (!/\d/.test(s)) return NaN
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  else s = s.replace(',', '.')
  return Number(s)
}

/**
 * Dates as owners write them: "20/11/2026", "20-11-2026", "2026-11-20" (day
 * first, the Indonesian way). Returns "2026-11-20", or null when it isn't a real date.
 */
export function keTanggal(v: Nilai | undefined): string | null {
  const s = String(v ?? '').trim()
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s) ?? /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (!m) return null
  const [t, b, h] = m[1].length === 4 ? [m[1], m[2], m[3]] : [m[3], m[2], m[1]]
  const d = new Date(Date.UTC(+t, +b - 1, +h))
  if (d.getUTCMonth() !== +b - 1 || d.getUTCDate() !== +h) return null
  return d.toISOString().slice(0, 10)
}

const kosong = (v: Nilai | undefined) => v === undefined || String(v).trim() === ''

/** Checks one row against a local table. Returns the problem in plain words, or null. */
export function periksaBaris(tabel: Tabel, b: Baris): string | null {
  for (const k of tabel.kolom) {
    const v = b[k.id]
    if (kosong(v)) {
      if (k.wajib || k.id === tabel.kunci) return `"${k.label}" belum diisi`
      continue
    }
    if (k.jenis === 'angka' && !Number.isFinite(keAngka(v))) return `"${k.label}" harus angka, bukan "${v}"`
    if (k.jenis === 'tanggal' && !keTanggal(v)) return `"${k.label}" harus tanggal (contoh 23/11/2026), bukan "${v}"`
    if (k.jenis === 'pilihan' && k.pilihan && !k.pilihan.includes(String(v)))
      return `"${k.label}" harus salah satu dari: ${k.pilihan.join(', ')}`
  }
  return null
}

/** Normalises a row to the table's columns: numbers become numbers, unknown columns are dropped. */
export function rapikanBaris(tabel: Tabel, b: Baris): Baris {
  const hasil: Baris = {}
  for (const k of tabel.kolom) {
    const v = b[k.id]
    if (kosong(v)) continue
    hasil[k.id] = k.jenis === 'angka' ? keAngka(v) : k.jenis === 'tanggal' ? (keTanggal(v) ?? String(v)) : String(v).trim()
  }
  return hasil
}

export interface KolomSambungan {
  id: string
  label: string
  jenis?: 'teks' | 'angka'
}

/**
 * Checks rows read from a connected page. Returns every problem in plain
 * words. An empty list means the read is real and usable; anything else means
 * the connection is NOT proven, whatever the login state looks like.
 */
export function periksaBacaan(
  s: { kunci: string; kolom: KolomSambungan[]; bolehKosong?: boolean },
  baris: unknown,
): string[] {
  if (!Array.isArray(baris)) return ['Hasil baca bukan daftar baris']
  if (baris.length === 0) return s.bolehKosong ? [] : ['0 baris terbaca dari halaman']
  const masalah: string[] = []
  const kunciDilihat = new Set<string>()
  baris.forEach((b: Baris, i) => {
    const k = b?.[s.kunci]
    if (kosong(k)) masalah.push(`Baris ${i + 1}: "${s.kunci}" kosong`)
    else if (kunciDilihat.has(String(k))) masalah.push(`"${k}" terbaca dua kali`)
    else kunciDilihat.add(String(k))
  })
  for (const k of s.kolom) {
    const nilai = baris.map((b: Baris) => b?.[k.id])
    if (nilai.every(kosong)) {
      masalah.push(`Kolom "${k.label}" kosong di semua baris`)
      continue
    }
    if (k.jenis === 'angka') {
      const salah = nilai.findIndex((v) => !kosong(v) && !Number.isFinite(keAngka(v)))
      if (salah >= 0) masalah.push(`Baris ${salah + 1}: "${k.label}" bukan angka ("${nilai[salah]}")`)
    }
  }
  return masalah.slice(0, 10)
}

const sama = (a: Nilai | undefined, b: Nilai) =>
  typeof b === 'number' ? keAngka(a) === b : String(a ?? '').trim() === String(b).trim()

/** After writing: which changes don't show on the page when it is read again. */
export function bandingkanTulisan(perubahan: Perubahan[], sesudah: Baris[], kunci: string): Perubahan[] {
  const perKunci = new Map(sesudah.map((b) => [String(b[kunci]), b]))
  return perubahan.filter((p) => !sama(perKunci.get(p.kunci)?.[p.kolom], p.ke))
}

// ── CSV ──────────────────────────────────────────────────────────────────

function pisah(baris: string, pemisah: string): string[] {
  const hasil: string[] = []
  let sel = ''
  let kutip = false
  for (const c of baris) {
    if (c === '"') kutip = !kutip
    else if (c === pemisah && !kutip) {
      hasil.push(sel.trim())
      sel = ''
    } else sel += c
  }
  hasil.push(sel.trim())
  return hasil
}

/** The CSV header for a table, so the owner can fill it in a spreadsheet. */
export function formatCsv(tabel: Tabel): string {
  return tabel.kolom.map((k) => k.id).join(',') + '\n'
}

/**
 * Reads a CSV for one table. The header may use the column id or its label
 * (case doesn't matter), separated by comma or semicolon. Errors name the row.
 */
export function bacaCsv(teks: string, tabel: Tabel): Baris[] {
  const baris = teks.replace(/^﻿/, '').split(/\r?\n/).filter((b) => b.trim())
  if (baris.length < 2) throw new Error('file kosong atau hanya berisi judul kolom')
  const pemisah = baris[0].includes(';') ? ';' : ','
  const judul = pisah(baris[0], pemisah).map((j) => j.toLowerCase())
  const posisi = new Map<Kolom, number>()
  for (const k of tabel.kolom) {
    const i = judul.findIndex((j) => j === k.id.toLowerCase() || j === k.label.toLowerCase())
    if (i < 0 && (k.wajib || k.id === tabel.kunci)) throw new Error(`kolom "${k.id}" tidak ada di baris judul`)
    if (i >= 0) posisi.set(k, i)
  }
  const kunci = new Set<string>()
  return baris.slice(1).map((b, i) => {
    const sel = pisah(b, pemisah)
    const mentah: Baris = {}
    for (const [k, p] of posisi) mentah[k.id] = sel[p] ?? ''
    const masalah = periksaBaris(tabel, mentah)
    if (masalah) throw new Error(`baris ${i + 2}: ${masalah}`)
    const rapi = rapikanBaris(tabel, mentah)
    const k = String(rapi[tabel.kunci])
    if (kunci.has(k)) throw new Error(`baris ${i + 2}: "${k}" sudah ada di baris lain`)
    kunci.add(k)
    return rapi
  })
}
