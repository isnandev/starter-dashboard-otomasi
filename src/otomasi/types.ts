import type { Baris, Perubahan } from '@/lib/types'

/**
 * What an automation can do. Everything goes through here so the dashboard
 * can show it, test mode can hold it back, and reads/writes are proven.
 */
export interface Konteks {
  /** True for "Coba dulu": nothing is saved or changed, only described. */
  uji: boolean
  /** The local tables (the main storage). */
  data: {
    semua(tabel: string): Promise<Baris[]>
    /** Adds or updates rows. In test mode only described. */
    simpan(tabel: string, baris: Baris[]): Promise<void>
  }
  /** Reads a sambungan's page, with proof. Throws when the read can't be proven. */
  baca(sambungan: string): Promise<Baris[]>
  /** Changes values on a sambungan's page, then re-reads to prove them. In test mode only described. */
  tulis(sambungan: string, perubahan: Perubahan[]): Promise<void>
  /** One plain-language line for the history, e.g. "Pak Budi: servis berikutnya 2 Des". */
  catat(baris: string): void
  /** Something the owner must act on (rancangan: Alarm). Same `kunci` = same alarm, not repeated. */
  alarm(kunci: string, pesan: string): void
  /** A draft the owner checks before using it (rancangan: Dicek manusia). Never sent automatically. */
  perluDicek(judul: string, isi: string): void
}

export interface Otomasi {
  id: string
  /** The rancangan's "Nama otomasi". */
  nama: string
  /** One sentence in the owner's words: what it does. */
  keterangan: string
  /** Also runs on the schedule (Pengaturan → Jadwal). Otherwise only from the dashboard button. */
  terjadwal: boolean
  /** Does the work and returns the one-line summary for the history. */
  jalankan(k: Konteks): Promise<string>
}
