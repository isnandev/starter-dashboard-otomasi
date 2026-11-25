import { sambungan as semuaSambungan } from '@/sambungan'
import type { Sambungan } from '@/sambungan/types'
import { ambil, simpan, tambahRiwayat } from './db'
import { cekTulisan, periksaBacaan } from './periksa'
import { sensorBaris } from './sensor'
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
      { masalah, contoh: Array.isArray(baris) ? sensorBaris(baris.slice(0, 3), s.kolom) : baris, halaman: alamat(tab.url) },
    )
  }
  return { baris, bukti: await simpanBukti(s, tab, baris) }
}

async function simpanBukti(s: Sambungan, tab: chrome.tabs.Tab, baris: Baris[]): Promise<Bukti> {
  const bukti: Bukti = { waktu: Date.now(), halaman: alamat(tab.url), jumlah: baris.length, contoh: baris.slice(0, 3) }
  await simpanStatus({
    id: s.id,
    keadaan: 'terbukti',
    waktu: bukti.waktu,
    pesan: `${bukti.jumlah} baris terbaca dari ${new URL(bukti.halaman).host}`,
    bukti,
  })
  return bukti
}

/** One read for re-checking a write: throws instead of recording a failure, so a retry can follow. */
async function bacaUntukCek(s: Sambungan, tab: chrome.tabs.Tab): Promise<Baris[]> {
  const baris = await s.baca(tab)
  const masalah = periksaBacaan(s, baris)
  if (masalah.length) throw new Error(masalah[0])
  return baris
}

/** Reloads the tab and waits until it has finished loading (at most 20 s). */
function muatUlangTab(tabId: number): Promise<void> {
  return new Promise((selesai) => {
    const beres = () => {
      clearTimeout(batas)
      chrome.tabs.onUpdated.removeListener(dengar)
      selesai()
    }
    const dengar = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') beres()
    }
    const batas = setTimeout(beres, 20_000)
    chrome.tabs.onUpdated.addListener(dengar)
    chrome.tabs.reload(tabId).catch(beres)
  })
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
  // Re-read until the change shows; reload the page once if it keeps showing
  // the old values (see JADWAL_CEK_TULISAN). A failed write must never be
  // reported as done, and a write that landed must not be reported as failed.
  const tabId = tab.id
  const cek = await cekTulisan(perubahan, s.kunci, {
    baca: () => bacaUntukCek(s, tab),
    muatUlang: s.muatUlangSaatCek === false || !tabId ? undefined : () => muatUlangTab(tabId),
  })
  if (!cek.belum.length && cek.baris) {
    await simpanBukti(s, tab, cek.baris)
    return
  }
  const saranCekDulu =
    'Jangan langsung coba lagi: perubahannya bisa saja sudah tersimpan. Refresh halamannya, lihat angkanya sendiri, baru putuskan. Kalau memang belum berubah, salin laporan untuk agent.'
  return gagal(
    s,
    cek.baris
      ? {
          pesan: `${cek.belum.length} dari ${perubahan.length} perubahan belum terlihat di halaman${cek.dimuatUlang ? ', juga setelah halamannya dimuat ulang' : ''}`,
          saran: saranCekDulu,
        }
      : { pesan: 'Setelah menyimpan, halamannya tidak bisa dibaca ulang', saran: saranCekDulu },
    { belumBerubah: cek.belum, catatanCek: cek.catatan },
  )
}

/**
 * The bukti as text for the agent. Sample rows are censored (sensor.ts):
 * only columns marked `aman` keep their text, numbers always stay. The
 * dashboard's own bukti table keeps the real values for the owner.
 */
export function laporanBukti(s: Sambungan, bukti: Bukti): string {
  return [
    'Bukti sambungan dari Dashboard Otomasi',
    `Sambungan: ${s.nama} (${s.id})`,
    `Halaman: ${bukti.halaman}`,
    `Waktu: ${new Date(bukti.waktu).toLocaleString('id-ID')}`,
    `Jumlah baris terbaca: ${bukti.jumlah}`,
    'Contoh baris (disensor: nomor HP diganti, teks pribadi jadi huruf depan; angka tetap):',
    JSON.stringify(sensorBaris(bukti.contoh, s.kolom), null, 2),
  ].join('\n')
}
