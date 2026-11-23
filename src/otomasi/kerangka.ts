import type { Otomasi } from './types'

/**
 * KERANGKA (skeleton) for an automation. Not registered, never register it
 * as-is. Copy it to `src/otomasi/<id>.ts`, map the rancangan onto it, and add
 * it to `src/otomasi/index.ts`. Table ids, columns and sambungan ids must be
 * ones that really exist in src/data/tabel.ts and src/sambungan/index.ts.
 *
 *   Pemicu (jadwal)    → terjadwal: true (the interval is in Pengaturan)
 *   Pemicu (kejadian)  → read the sambungan and compare with the local table
 *   Data yang dipakai  → k.data.semua('<tabel>')
 *   Langkah / Aturan   → the code below, one k.catat() line per step that matters
 *   Peran AI           → a formula or isiTemplate() (@/lib/utils) here (no AI inside the tool)
 *   Hasil              → k.data.simpan() and/or k.tulis()
 *   Batas aman         → checks before k.tulis(); test mode is handled for you
 *   Alarm              → k.alarm()
 *   Dicek manusia      → k.perluDicek(): a draft, never sent automatically
 */
export const kerangkaOtomasi: Otomasi = {
  id: 'kerangka',
  nama: 'Kerangka otomasi (belum dibuat)',
  keterangan: '',
  terjadwal: false,
  async jalankan(k) {
    const baris = await k.data.semua('TODO-tabel')
    const halaman = await k.baca('TODO-sambungan')
    k.catat(`${baris.length} baris lokal, ${halaman.length} baris di halaman`)
    // Example of a template draft, filled from one row:
    // k.perluDicek('Pengingat untuk ' + b.nama, isiTemplate('Halo {nama}, ...', b))  (isiTemplate from @/lib/utils)
    throw new Error('Kerangka otomasi belum dibuat')
  },
}
