import { BelumDibuat, jalankanDiTab, type Sambungan } from './types'

/**
 * KERANGKA (skeleton) for a real sambungan. Not registered, never register it
 * as-is. Copy it to `src/sambungan/<id>.ts` and fill it in.
 *
 * Every value below comes from the SURVEY REPORT of the real page (dashboard
 * → Sambungan → "Survei halaman ini" → "Salin hasil survei untuk agent"), or
 * from a screenshot the owner sent. Never guess a selector, a column or a URL.
 * If the survey doesn't show what you need, ask for another survey (a
 * different page, or after the owner scrolls / opens the right tab).
 *
 * Prefer semantic selectors (role, aria-label, header text, data-*, name)
 * over generated CSS classes; see the semantic-debugging skill.
 */

const SELECTOR = {
  /** The element that holds the list. If it isn't on the page, reading fails. From the survey. */
  wadah: '', // TODO, e.g. 'table[aria-label="Daftar booking"]'
  /** One row inside `wadah`. From the survey. */
  baris: '', // TODO, e.g. 'tbody tr'
  /** One selector per column, inside a row. Column ids match `kolom` below. */
  kolom: {} as Record<string, string>, // TODO, e.g. { no_booking: 'td:nth-child(1)', status: 'select[name="status"]' }
}

export const kerangka: Sambungan = {
  id: 'kerangka',
  nama: 'Kerangka sambungan (belum dibuat)',
  pola: '', // TODO, e.g. 'https://booking.contoh.com/*' (also in manifest host_permissions)
  halaman: '', // TODO, the page from the survey
  kunci: '', // TODO, the column that identifies a row
  kolom: [], // TODO, e.g. [{ id: 'no_booking', label: 'No. booking' }, { id: 'status', label: 'Status' }]
  survei: '', // TODO, e.g. 'survei 23 Nov 2026, booking.contoh.com/jadwal'

  async baca(tab) {
    if (!SELECTOR.wadah || !SELECTOR.baris) throw new BelumDibuat('Cara membaca halaman ini')
    return jalankanDiTab(
      tab,
      (sel: typeof SELECTOR) => {
        // Runs inside the page: only use the arguments.
        const wadah = document.querySelector(sel.wadah)
        if (!wadah) return { galat: `Daftar data tidak ditemukan di halaman (${sel.wadah})` }
        const teks = (el: Element | null) => {
          if (!el) return ''
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return el.value.trim()
          return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
        }
        return [...wadah.querySelectorAll(sel.baris)].map((b) =>
          Object.fromEntries(Object.entries(sel.kolom).map(([id, s]) => [id, teks(b.querySelector(s))])),
        )
      },
      [SELECTOR],
    )
  },

  // Only when the rancangan changes something on this page. Remove otherwise.
  async tulis() {
    // TODO: fill the inputs found in the survey and press the page's own save
    // button; wait until the page confirms. Return only after saving.
    // The dashboard then re-reads the page and fails if the values didn't stick.
    // Most web apps ignore `input.value = x`. Inside the page, use the native
    // setter and fire an input event so the page notices:
    //   const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    //   setter.call(input, String(nilai)); input.dispatchEvent(new Event('input', { bubbles: true }))
    throw new BelumDibuat('Cara mengubah data di halaman ini')
  },
}
