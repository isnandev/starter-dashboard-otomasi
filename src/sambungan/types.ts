import type { KolomSambungan } from '@/lib/periksa'
import type { Baris, Perubahan } from '@/lib/types'

/**
 * A sambungan is a bridge between the local data and one web page the owner
 * already has open and is logged in to (a marketplace seller page, a booking
 * site, a web app, WhatsApp Web...). The extension reads or fills that page.
 * No API keys, no OAuth. The page is never the main storage: the local
 * tables are.
 *
 * A sambungan is "terbukti" (proven) only when the dashboard has PROOF: real rows read
 * from the real page that pass `periksaBacaan`. A logged-in tab or a login
 * marker is not proof. See src/lib/sambungan.ts.
 */
export interface Sambungan {
  id: string
  /** What the owner sees, e.g. "Aplikasi booking · jadwal hari ini". */
  nama: string
  /** Match pattern of the page. Also add it to host_permissions in public/manifest.json. */
  pola: string
  /** The page the "Buka halaman" button opens. */
  halaman: string
  /** Column that identifies a row on the page (same values as the local table's kunci). */
  kunci: string
  /** Columns this sambungan reads, named as they appear in the survey report. */
  kolom: KolomSambungan[]
  /**
   * True only for pages that can legitimately show no rows (e.g. "pesanan
   * baru"). Even then, `baca` must throw when the list itself isn't on the
   * page: [] means "the list is there and empty", never "not found".
   */
  bolehKosong?: boolean
  /** The survey this was built from, e.g. "survei 23 Nov 2026, booking.contoh.com/jadwal". */
  survei: string
  /** Read the rows on the open page. Throw when the page isn't the expected one. */
  baca(tab: chrome.tabs.Tab): Promise<Baris[]>
  /** Optional: change values on the page. The dashboard re-reads afterwards to prove it. */
  tulis?(tab: chrome.tabs.Tab, perubahan: Perubahan[]): Promise<void>
  /**
   * After `tulis`, when the page still shows the old values, the dashboard
   * reloads the page once and reads again (many pages only show a saved value
   * after a refresh). Set false only when reloading this page would lose
   * something, e.g. a half-typed message.
   */
  muatUlangSaatCek?: boolean
}

/** Thrown by a sambungan (or one of its methods) that isn't built yet. Never return [] instead. */
export class BelumDibuat extends Error {
  constructor(bagian = 'sambungan') {
    super(`${bagian} belum dibuat`)
    this.name = 'BelumDibuat'
  }
}

/**
 * Runs `fungsi` inside the page. `fungsi` is copied into the page, so it can
 * only use its arguments (no imports, no outside variables). To report a
 * problem from inside the page, return `{ galat: 'what went wrong' }`.
 */
export async function jalankanDiTab<A extends unknown[], T>(
  tab: chrome.tabs.Tab,
  fungsi: (...args: A) => T | { galat: string },
  args: A,
): Promise<T> {
  if (!tab.id) throw new Error('Tab tidak punya id')
  const [hasil] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: fungsi as (...args: unknown[]) => unknown,
    args,
  })
  const isi = hasil?.result as T | { galat: string } | undefined
  if (isi && typeof isi === 'object' && 'galat' in isi) throw new Error(String(isi.galat))
  if (isi === undefined || isi === null) throw new Error('Halaman tidak mengembalikan hasil')
  return isi as T
}
