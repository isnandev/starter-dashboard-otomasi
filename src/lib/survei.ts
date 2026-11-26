import { ambil, simpan, tambahRiwayat } from './db'
import { sensorSurvei } from './sensor'

// "Survei halaman": before any sambungan is written, the extension looks at
// the real page and reports what is on it (tables, repeated lists, form
// fields, buttons, the attributes it can hold on to). The agent builds the
// sambungan from this report, so selectors and columns come from the real
// page, never from a guess.

export interface HasilSurvei {
  halaman: string
  judul: string
  waktu: number
  bingkai: number
  /**
   * What was surveyed, in the owner's words: the part they highlighted, an
   * open dialog, the page's main area, or (only when none of those exist) the
   * whole page. Side lists such as a chat list stay out unless highlighted.
   */
  bagian?: string
  /** Selector of the surveyed part ('' for the whole page). */
  penandaBagian?: string
  /** True on the censored copy that goes to the agent (see sensor.ts). */
  disensor?: boolean
  judulBagian: string[]
  /**
   * `baris`/`sel`: the shape of one data row and its cells (tag, role, data-*
   * attribute names), `isiSel`: what each cell holds ("teks" or the input,
   * select, button or link inside it).
   */
  tabel: { penanda: string; baris: string; sel: string; kolom: string[]; isiSel: string[]; jumlahBaris: number; contoh: string[][] }[]
  daftar: { penanda: string; item: string; jumlah: number; contoh: string[] }[]
  isian: { label: string; penanda: string; jenis: string; nilai: string }[]
  tombol: string[]
  atribut: string[]
}

/** Runs inside the surveyed page. Self-contained: no imports, no outside variables. */
export function surveiHalaman(): HasilSurvei {
  const teks = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const terlihat = (el: Element) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  const css = (v: string) => CSS.escape(v)
  // The most meaningful handle on an element: id, test id, aria-label, name, placeholder, role, then tag + class.
  const penanda = (el: Element): string => {
    const tag = el.tagName.toLowerCase()
    if (el.id && !/\d{3,}/.test(el.id)) return `#${css(el.id)}`
    for (const a of ['data-testid', 'data-test', 'data-cy', 'aria-label', 'name', 'placeholder', 'role', 'type']) {
      const v = el.getAttribute(a)
      if (v) return `${tag}[${a}="${v.replace(/"/g, '\\"')}"]`
    }
    const kelas = [...el.classList].filter((c) => !/\d{3,}|^css-|^sc-|__/.test(c)).slice(0, 2)
    return tag + kelas.map((c) => `.${css(c)}`).join('')
  }
  // The shape shared by every row or cell of a kind: tag, role, data-* attribute names (not values).
  const bentuk = (el: Element) => {
    const role = el.getAttribute('role')
    const data = el.getAttributeNames().filter((a) => a.startsWith('data-'))
    return el.tagName.toLowerCase() + (role ? `[role="${role}"]` : '') + data.map((a) => `[${a}]`).join('')
  }
  const sel = (r: Element) => [...r.querySelectorAll(':scope > th, :scope > td, :scope > [role=cell], :scope > [role=gridcell], :scope > [role=columnheader]')]

  // What to survey, so side lists (a chat list, other customers) stay out:
  // 1. the part the owner highlighted (sorot teks di dua baris daftarnya),
  // 2. an open dialog, 3. the page's main area, 4. only then the whole page.
  let akar: Element = document.body
  let bagian = 'seluruh halaman (tidak ada bagian utama)'
  const sorot = getSelection()
  const daftarLike = 'table, [role=table], [role=grid], [role=list], [role=listbox], ul, ol'
  if (sorot && !sorot.isCollapsed && sorot.rangeCount) {
    const n = sorot.getRangeAt(0).commonAncestorContainer
    const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement
    if (el && el !== document.body) {
      akar = el.closest(daftarLike) ?? el
      bagian = 'bagian yang kamu sorot'
    }
  } else {
    const dialog = [...document.querySelectorAll('[role=dialog], [role=alertdialog], [aria-modal=true], dialog[open]')].filter(terlihat).pop()
    const utama = [...document.querySelectorAll('main, [role=main]')].filter(terlihat)[0]
    if (dialog) {
      akar = dialog
      bagian = 'jendela (dialog) yang sedang terbuka'
    } else if (utama) {
      akar = utama
      bagian = 'bagian utama halaman'
    }
  }
  const dalam = (q: string) => [...(akar.matches(q) ? [akar] : []), ...akar.querySelectorAll(q)]
  // Sample rows: the first two and the last one (lists often put the newest last).
  const ambilContoh = <T,>(xs: T[]) => (xs.length <= 3 ? xs : [xs[0], xs[1], xs[xs.length - 1]])

  const judulBagian = dalam('h1, h2, h3, [role=heading]').filter(terlihat).map(teks).filter(Boolean).slice(0, 20)

  const tabel = dalam('table, [role=table], [role=grid]')
    .filter(terlihat)
    .slice(0, 5)
    .map((t) => {
      const baris = [...t.querySelectorAll('tr, [role=row]')]
      const contohBaris = baris[1]
      const selPertama = contohBaris ? sel(contohBaris)[0] : undefined
      return {
        penanda: penanda(t),
        baris: contohBaris ? bentuk(contohBaris) : '',
        sel: selPertama ? bentuk(selPertama) : '',
        kolom: sel(baris[0] ?? t).map(teks),
        isiSel: contohBaris ? sel(contohBaris).map((c) => {
          const isi = c.querySelector('input, select, textarea, button, a[href]')
          return isi ? penanda(isi) : 'teks'
        }) : [],
        jumlahBaris: Math.max(0, baris.length - 1),
        contoh: ambilContoh(baris.slice(1)).map((b) => sel(b).map(teks)),
      }
    })

  // Repeated lists built from divs (common in web apps): a parent with 3+
  // children of the same kind that hold text.
  const tanda = (el: Element) => {
    const kelas = [...el.classList].find((c) => !/\d{3,}/.test(c))
    return el.tagName.toLowerCase() + (kelas ? `.${css(kelas)}` : '')
  }
  const daftar: HasilSurvei['daftar'] = []
  for (const induk of dalam('*')) {
    if (induk.closest('table, [role=table], [role=grid]') || induk.children.length < 3 || !terlihat(induk)) continue
    const hitung = new Map<string, Element[]>()
    for (const anak of induk.children) {
      if (!teks(anak)) continue
      const t = tanda(anak)
      hitung.set(t, [...(hitung.get(t) ?? []), anak])
    }
    for (const [item, anak] of hitung) {
      if (anak.length >= 3 && teks(anak[0]).length > 3 && !daftar.some((d) => d.penanda === penanda(induk) && d.item === item))
        daftar.push({ penanda: penanda(induk), item, jumlah: anak.length, contoh: ambilContoh(anak).map(teks) })
    }
  }
  daftar.sort((a, b) => b.jumlah - a.jumlah)

  const labelUntuk = (el: Element) => {
    const id = el.getAttribute('id')
    const lbl = id ? document.querySelector(`label[for="${css(id)}"]`) : el.closest('label')
    return teks(lbl) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || ''
  }
  const isian = dalam('input:not([type=hidden]), select, textarea, [contenteditable=true]')
    .filter(terlihat)
    .slice(0, 30)
    .map((el) => ({
      label: labelUntuk(el),
      penanda: penanda(el),
      jenis: el.getAttribute('type') ?? el.tagName.toLowerCase(),
      // Values of password fields are never read.
      nilai: el.getAttribute('type') === 'password' ? '' : ((el as HTMLInputElement).value ?? '').slice(0, 40),
    }))

  const tombol = [...new Set(dalam('button, [role=button], input[type=submit]').filter(terlihat).map((b) => teks(b) || b.getAttribute('aria-label') || '').filter(Boolean))].slice(0, 30)

  const hitungAtribut = new Map<string, number>()
  for (const el of dalam('*'))
    for (const a of el.getAttributeNames())
      if (a.startsWith('data-') || a === 'aria-label' || a === 'name') hitungAtribut.set(a, (hitungAtribut.get(a) ?? 0) + 1)
  const atribut = [...hitungAtribut].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([a, n]) => `${a} (${n}×)`)

  return {
    halaman: location.origin + location.pathname,
    judul: document.title,
    waktu: Date.now(),
    bingkai: dalam('iframe').length,
    bagian,
    penandaBagian: akar === document.body ? '' : penanda(akar),
    judulBagian,
    tabel,
    daftar: daftar.slice(0, 5),
    isian,
    tombol,
    atribut,
  }
}

/** Ask Chrome for access to this one site. Must be called straight from a button click. */
export function mintaIzin(url: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [new URL(url).origin + '/*'] })
}

export async function jalankanSurvei(tab: chrome.tabs.Tab): Promise<HasilSurvei> {
  if (!tab.id) throw new Error('Tab tidak punya id')
  const [h] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: surveiHalaman })
  const hasil = h?.result as HasilSurvei | undefined
  if (!hasil) throw new Error('Halaman tidak mengembalikan hasil survei')
  const list = await semuaSurvei()
  await simpan('survei', [hasil, ...list.filter((s) => s.halaman !== hasil.halaman)].slice(0, 10))
  await tambahRiwayat({
    jenis: 'survei',
    ringkas: `Survei ${new URL(hasil.halaman).host}: ${ringkasSurvei(hasil)}`,
    teknis: laporanSurvei(hasil),
  })
  return hasil
}

export function semuaSurvei(): Promise<HasilSurvei[]> {
  return ambil<HasilSurvei[]>('survei', [])
}

export function ringkasSurvei(h: HasilSurvei): string {
  return [
    `${h.tabel.length} tabel`,
    `${h.daftar.length} daftar berulang`,
    `${h.isian.length} kolom isian`,
    `${h.tombol.length} tombol`,
  ].join(' · ')
}

/**
 * The survey as text for the agent. Censored by default (sensor.ts): the agent
 * gets the structure, the selectors and the format of numbers, never customer
 * names, phone numbers or chat text. `asli` only for pages without customer data.
 */
export function laporanSurvei(mentah: HasilSurvei, { asli = false } = {}): string {
  const h = asli ? mentah : sensorSurvei(mentah)
  return [
    'Laporan survei halaman dari Dashboard Otomasi',
    `Halaman: ${h.halaman}`,
    `Judul: ${h.judul}`,
    `Waktu: ${new Date(h.waktu).toLocaleString('id-ID')}`,
    `Yang disurvei: ${h.bagian ?? 'seluruh halaman'}${h.penandaBagian ? ` (${h.penandaBagian})` : ''}`,
    ...(h.bingkai ? [`Catatan: bagian ini punya ${h.bingkai} iframe; isinya tidak ikut disurvei.`] : []),
    'Isi: struktur halaman dan paling banyak 3 contoh baris per daftar (2 pertama + 1 terakhir). Kata sandi tidak pernah dibaca.',
    asli
      ? 'Contoh baris: teks ASLI (pemilik memilih tanpa sensor).'
      : 'Contoh baris: disensor. Nomor HP, email dan angka panjang diganti; kata diganti huruf depannya ("Bu Siti" → "B… S…"). Angka, harga, tanggal dan kode tetap.',
    '',
    JSON.stringify(h, null, 2),
  ].join('\n')
}
