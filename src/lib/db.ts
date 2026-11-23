import { openDB, type DBSchema } from 'idb'
import type { Baris, Pengaturan, Riwayat, Tabel } from './types'

// Local-first: the dashboard IS the main storage. Every table lives in
// IndexedDB on this computer. No cloud, no server, no account to set up.
// The dashboard and the background worker share this database.
// Connected pages (marketplaces, web apps) are only read from or written to;
// they are never the place the data lives.

interface Rekaman {
  tabel: string
  kunci: string
  isi: Baris
}

interface Skema extends DBSchema {
  baris: { key: [string, string]; value: Rekaman; indexes: { tabel: string } }
  riwayat: { key: number; value: Riwayat; indexes: { waktu: number } }
  kv: { key: string; value: unknown }
}

const db = openDB<Skema>('dashboard-otomasi', 1, {
  upgrade(d) {
    const b = d.createObjectStore('baris', { keyPath: ['tabel', 'kunci'] })
    b.createIndex('tabel', 'tabel')
    const r = d.createObjectStore('riwayat', { keyPath: 'id', autoIncrement: true })
    r.createIndex('waktu', 'waktu')
    d.createObjectStore('kv')
  },
})

export const PENGATURAN_AWAL: Pengaturan = {
  namaUsaha: '', // the owner fills it in Pengaturan; no sample name
  intervalMenit: 15,
  modeUji: true,
  jeda: false,
  panduanSelesai: false,
  tema: 'sistem',
}

const rekam = (t: Tabel, isi: Baris): Rekaman => ({ tabel: t.id, kunci: String(isi[t.kunci]), isi })

export async function semuaBaris(tabel: string): Promise<Baris[]> {
  return (await (await db).getAllFromIndex('baris', 'tabel', tabel)).map((r) => r.isi)
}

/** Adds or updates rows (matched by the table's kunci). */
export async function simpanBaris(t: Tabel, list: Baris[]) {
  const tx = (await db).transaction('baris', 'readwrite')
  await Promise.all([...list.map((b) => tx.store.put(rekam(t, b))), tx.done])
}

/** Replaces the whole table (CSV import). */
export async function gantiSemuaBaris(t: Tabel, list: Baris[]) {
  const tx = (await db).transaction('baris', 'readwrite')
  const lama = await tx.store.index('tabel').getAllKeys(t.id)
  await Promise.all([...lama.map((k) => tx.store.delete(k)), ...list.map((b) => tx.store.put(rekam(t, b))), tx.done])
}

export async function hapusBaris(tabel: string, kunci: string) {
  await (await db).delete('baris', [tabel, kunci])
}

export async function tambahRiwayat(r: Omit<Riwayat, 'id' | 'waktu'> & { waktu?: number }) {
  await (await db).add('riwayat', { waktu: Date.now(), ...r })
}

export async function riwayatTerbaru(batas = 200): Promise<Riwayat[]> {
  const list = await (await db).getAllFromIndex('riwayat', 'waktu')
  return list.reverse().slice(0, batas)
}

export async function ambil<T>(kunci: string, awal: T): Promise<T> {
  const v = await (await db).get('kv', kunci)
  return v === undefined ? awal : (v as T)
}

export async function simpan<T>(kunci: string, nilai: T) {
  await (await db).put('kv', nilai, kunci)
}

export async function pengaturan(): Promise<Pengaturan> {
  return { ...PENGATURAN_AWAL, ...(await ambil<Partial<Pengaturan>>('pengaturan', {})) }
}

export async function ubahPengaturan(ubah: Partial<Pengaturan>) {
  await simpan('pengaturan', { ...(await pengaturan()), ...ubah })
}

const JENIS_CADANGAN = 'cadangan-dashboard-otomasi'

/** Backup file: every table and the settings, as JSON. */
export async function buatCadangan(): Promise<string> {
  const d = await db
  return JSON.stringify(
    {
      jenis: JENIS_CADANGAN,
      versi: 1,
      dibuat: new Date().toISOString(),
      baris: await d.getAll('baris'),
      pengaturan: await pengaturan(),
    },
    null,
    2,
  )
}

export async function pulihkanCadangan(isi: string) {
  const data = JSON.parse(isi)
  if (data?.jenis !== JENIS_CADANGAN || !Array.isArray(data.baris)) throw new Error('Bukan file cadangan dashboard ini')
  const tx = (await db).transaction('baris', 'readwrite')
  await tx.store.clear()
  await Promise.all([...data.baris.map((r: Rekaman) => tx.store.put(r)), tx.done])
  await simpan('pengaturan', data.pengaturan)
}

export async function hapusSemua() {
  const d = await db
  await Promise.all([d.clear('baris'), d.clear('riwayat'), d.clear('kv')])
}
