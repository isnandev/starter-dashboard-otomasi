// ── Local data: the main storage of the business ──────────────────────────
// The tables are defined per business in src/data/tabel.ts, from the owner's
// own sample data (or a recommendation they approved). Nothing here is about
// one kind of business.

export type JenisKolom = 'teks' | 'angka' | 'tanggal' | 'pilihan'

export interface Kolom {
  /** Column id, also the CSV header. lowercase_snake, e.g. "no_hp". */
  id: string
  /** What the owner sees, e.g. "No. HP". */
  label: string
  jenis: JenisKolom
  /** Allowed values when jenis is 'pilihan'. */
  pilihan?: string[]
  wajib?: boolean
}

export interface Tabel {
  /** e.g. "pelanggan" */
  id: string
  /** e.g. "Pelanggan" */
  nama: string
  /** The column that identifies one row (unique), e.g. "kode" or "no_hp". */
  kunci: string
  kolom: Kolom[]
  /**
   * Where these columns came from, shown on the Data screen. Either the
   * owner's own sample ("contoh dari pemilik: daftar-servis.xlsx, 23 Nov
   * 2026") or an approved recommendation ("rekomendasi agent, disetujui
   * pemilik 23 Nov 2026"). Never empty.
   */
  asal: string
  /**
   * True for tables that fill up over time from automations or daily work
   * (pesanan, booking masuk, stok masuk). Empty on day one is normal for
   * them, so the Beranda doesn't call it a problem.
   */
  bolehKosong?: boolean
}

export type Nilai = string | number
export type Baris = Record<string, Nilai>

// ── Proof (bukti) ─────────────────────────────────────────────────────────
// Nothing counts as "connected" or "done" without proof: real rows read from
// the real page, shown to the owner so they can compare with what they see.

export interface Bukti {
  waktu: number
  /** Page the rows came from (origin + path, no query string). */
  halaman: string
  /** How many rows were read. */
  jumlah: number
  /** Up to 3 rows exactly as read. */
  contoh: Baris[]
}

export type KeadaanSambungan = 'belum-dicoba' | 'terbukti' | 'gagal'

export interface StatusSambungan {
  id: string
  keadaan: KeadaanSambungan
  /** Plain words: "24 baris terbaca dari seller.contoh.com" or why it failed. */
  pesan: string
  /** What the owner should do next. */
  saran?: string
  bukti?: Bukti
  waktu: number
}

/** One value to change on a connected page. */
export interface Perubahan {
  /** Row key on the page (same values as the local table's kunci). */
  kunci: string
  kolom: string
  dari?: Nilai | null
  ke: Nilai
  /** Plain name of the row for the history, e.g. the product or customer name. */
  label?: string
}

// ── History, settings, status ────────────────────────────────────────────

export type JenisRiwayat =
  | 'otomasi'
  | 'uji'
  | 'alarm'
  | 'impor'
  | 'data'
  | 'cadangan'
  | 'sambungan'
  | 'survei'
  | 'galat'
  | 'pengaturan'

export interface Riwayat {
  id?: number
  waktu: number
  jenis: JenisRiwayat
  /** One plain-language line, e.g. "3 booking baru dibaca dari aplikasi booking". */
  ringkas: string
  /** Extra plain-language lines. */
  detail?: string[]
  /** Technical details or a report for the coding agent. Never the main text. */
  teknis?: string
}

export interface Pengaturan {
  namaUsaha: string
  intervalMenit: number
  /** Test mode: automations only show what would change. On until the owner turns it off. */
  modeUji: boolean
  /** Pause switch for every automation. */
  jeda: boolean
  panduanSelesai: boolean
  tema: 'terang' | 'gelap' | 'sistem'
}

export type TingkatStatus = 'aman' | 'perhatian' | 'berhenti'

export interface StatusUmum {
  tingkat: TingkatStatus
  kalimat: string
  saran?: string
}

/** Something the owner must act on (rancangan: Alarm). */
export interface Alarm {
  kunci: string
  otomasi: string
  pesan: string
  waktu: number
}

/** A draft the owner checks before using it (rancangan: Dicek manusia). */
export interface PerluDicek {
  id: string
  otomasi: string
  judul: string
  isi: string
  waktu: number
}

export interface HasilOtomasi {
  id: string
  nama: string
  berhasil: boolean
  ringkas: string
  detail: string[]
}

export interface HasilJalan {
  uji: boolean
  waktu: number
  otomasi: HasilOtomasi[]
}
