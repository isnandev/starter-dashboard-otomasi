import { sambungan as semuaSambungan } from '@/sambungan'
import type { Sambungan } from '@/sambungan/types'
import { ambil, simpan, tambahRiwayat } from './db'
import { bandingkanTulisan, periksaBacaan } from './periksa'
import type { Baris, Bukti, Perubahan, StatusSambungan } from './types'

// Proof for every connection. A sambungan is "terbukti" (proven) only after
// real rows were read from the real page and passed periksaBacaan. Every read
// and write by an automation goes through here, so a failed read can never be
// reported as success, and a write is checked by reading the page again.

const KUNCI_STATUS = 'status-sambungan'

export class GagalSambungan extends Error {
  status: StatusSambungan
  constructor(status: StatusSambungan) {
    super(`${status.pesan}. ${status.saran ?? ''}`)
    this.name = 'GagalSambungan'
    this.status = status
  }
}

export async function semuaStatusSambungan(): Promise<Record<string, StatusSambungan>> {
  return ambil<Record<string, StatusSambungan>>(KUNCI_STATUS, {})
}

async function simpanStatus(st: StatusSambungan) {
  await simpan(KUNCI_STATUS, { ...(await semuaStatusSambungan()), [st.id]: st })
}

export function cariSambungan(id: string): Sambungan {
  const s = semuaSambungan.find((x) => x.id === id)
  if (!s) throw new Error(`Sambungan "${id}" tidak terdaftar di src/sambungan/index.ts`)
  return s
}

const alamat = (url?: string) => {
  try {
    const u = new URL(url ?? '')
    return u.origin + u.pathname
  } catch {
    return url ?? '?'
  }
}

/** Plain words for what went wrong, plus what to do. */
function jelaskan(s: Sambungan, e: unknown): Pick<StatusSambungan, 'pesan' | 'saran'> {
  const pesan = e instanceof Error ? e.message : String(e)
  if (e instanceof Error && e.name === 'BelumDibuat')
    return { pesan: `Sambungan belum selesai dibuat (${pesan})`, saran: 'Minta agent menyelesaikannya dari hasil survei halaman.' }
  if (/Cannot access|permission|host/i.test(pesan))
    return {
      pesan: 'Extension belum diberi izin membuka halaman ini',
      saran: `Minta agent menambahkan ${s.pola} ke manifest, lalu muat ulang extension.`,
    }
  return { pesan: `Data tidak bisa dibaca dari ${s.nama}: ${pesan}`, saran: 'Pastikan halamannya benar dan sudah login. Kalau tetap gagal, salin laporan untuk agent.' }
}

async function gagal(s: Sambungan, isi: Pick<StatusSambungan, 'pesan' | 'saran'>, teknis: unknown): Promise<never> {
  const st: StatusSambungan = { id: s.id, keadaan: 'gagal', waktu: Date.now(), ...isi }
  await simpanStatus(st)
  await tambahRiwayat({
    jenis: 'galat',
    ringkas: `${s.nama}: ${st.pesan}`,
    detail: st.saran ? [st.saran] : undefined,
    teknis: JSON.stringify(
      {
        sambungan: s.id,
        pola: s.pola,
        survei: s.survei,
        status: st,
        galat: teknis instanceof Error ? `${teknis.name}: ${teknis.message}\n${teknis.stack ?? ''}` : teknis,
      },
      null,
      2,
    ),
  })
  throw new GagalSambungan(st)
}

async function cariTab(s: Sambungan): Promise<chrome.tabs.Tab | undefined> {
  if (!s.pola) return undefined
  const [tab] = await chrome.tabs.query({ url: s.pola })
  return tab
}

/** Reads the page and proves it. Throws GagalSambungan (already in the history) when it can't. */
export async function bacaTerbukti(s: Sambungan): Promise<{ baris: Baris[]; bukti: Bukti }> {
  const tab = await cariTab(s)
  if (!tab) {
    return gagal(s, { pesan: 'Halamannya belum dibuka', saran: `Buka ${s.halaman || s.nama} di Chrome dan login, lalu coba lagi.` }, 'tab tidak ditemukan untuk ' + s.pola)
  }
  let baris: Baris[]
  try {
    baris = await s.baca(tab)
  } catch (e) {
    return gagal(s, jelaskan(s, e), e)
  }
  const masalah = periksaBacaan(s, baris)
  if (masalah.length) {
    return gagal(
      s,
      { pesan: `Data yang terbaca belum benar: ${masalah[0]}`, saran: 'Salin laporan untuk agent. Agent perlu survei ulang halamannya.' },
      { masalah, contoh: Array.isArray(baris) ? baris.slice(0, 3) : baris, halaman: alamat(tab.url) },
    )
  }
  const bukti: Bukti = { waktu: Date.now(), halaman: alamat(tab.url), jumlah: baris.length, contoh: baris.slice(0, 3) }
  await simpanStatus({
    id: s.id,
    keadaan: 'terbukti',
    waktu: bukti.waktu,
    pesan: `${bukti.jumlah} baris terbaca dari ${new URL(bukti.halaman).host}`,
    bukti,
  })
  return { baris, bukti }
}

/** The "Tes sambungan" button: read once, show the proof, write it to the history. */
export async function tesSambungan(s: Sambungan): Promise<void> {
  try {
    const { bukti } = await bacaTerbukti(s)
    await tambahRiwayat({
      jenis: 'sambungan',
      ringkas: `${s.nama} terbukti tersambung: ${bukti.jumlah} baris terbaca`,
      detail: bukti.contoh.map((b) => Object.entries(b).map(([k, v]) => `${k}: ${v}`).join(' · ')),
      teknis: laporanBukti(s, bukti),
    })
  } catch (e) {
    if (!(e instanceof GagalSambungan)) throw e
  }
}

/**
 * Writes changes to the page, then reads it again and checks every value.
 * Throws GagalSambungan when any change doesn't show on the page.
 */
export async function tulisTerbukti(s: Sambungan, perubahan: Perubahan[]): Promise<void> {
  if (!perubahan.length) return
  if (!s.tulis) return gagal(s, { pesan: 'Sambungan ini hanya bisa membaca', saran: 'Minta agent menambahkan cara mengubah data, dari hasil survei.' }, 'tulis tidak ada')
  const tab = await cariTab(s)
  if (!tab) return gagal(s, { pesan: 'Halamannya belum dibuka', saran: `Buka ${s.halaman || s.nama} di Chrome dan login, lalu coba lagi.` }, 'tab tidak ditemukan')
  try {
    await s.tulis(tab, perubahan)
  } catch (e) {
    return gagal(s, jelaskan(s, e), e)
  }
  // ponytail: fixed waits (1 s, then 3 s); give the sambungan its own wait if a page saves slower.
  let belum = perubahan
  for (const tunggu of [1000, 3000]) {
    await new Promise((r) => setTimeout(r, tunggu))
    const { baris } = await bacaTerbukti(s)
    belum = bandingkanTulisan(perubahan, baris, s.kunci)
    if (!belum.length) return
  }
  return gagal(
    s,
    {
      pesan: `${belum.length} dari ${perubahan.length} perubahan tidak terlihat di halaman setelah disimpan`,
      saran: 'Cek halamannya. Salin laporan untuk agent supaya cara menyimpannya diperbaiki.',
    },
    { belumBerubah: belum },
  )
}

export function laporanBukti(s: Sambungan, bukti: Bukti): string {
  return [
    'Bukti sambungan dari Dashboard Otomasi',
    `Sambungan: ${s.nama} (${s.id})`,
    `Halaman: ${bukti.halaman}`,
    `Waktu: ${new Date(bukti.waktu).toLocaleString('id-ID')}`,
    `Jumlah baris terbaca: ${bukti.jumlah}`,
    'Contoh baris (bandingkan dengan yang terlihat di halaman):',
    JSON.stringify(bukti.contoh, null, 2),
  ].join('\n')
}
