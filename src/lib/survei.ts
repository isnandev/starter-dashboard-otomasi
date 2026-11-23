import { ambil, simpan, tambahRiwayat } from './db'

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
  judulBagian: string[]
  tabel: { penanda: string; kolom: string[]; jumlahBaris: number; contoh: string[][] }[]
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
  const sel = (r: Element) => [...r.querySelectorAll(':scope > th, :scope > td, :scope > [role=cell], :scope > [role=gridcell], :scope > [role=columnheader]')]

  const judulBagian = [...document.querySelectorAll('h1, h2, h3, [role=heading]')].filter(terlihat).map(teks).filter(Boolean).slice(0, 20)

  const tabel = [...document.querySelectorAll('table, [role=table], [role=grid]')]
    .filter(terlihat)
    .slice(0, 5)
    .map((t) => {
      const baris = [...t.querySelectorAll('tr, [role=row]')]
      return {
        penanda: penanda(t),
        kolom: sel(baris[0] ?? t).map(teks),
        jumlahBaris: Math.max(0, baris.length - 1),
        contoh: baris.slice(1, 4).map((b) => sel(b).map(teks)),
      }
    })

  // Repeated lists built from divs (common in web apps): a parent with 3+
  // children of the same kind that hold text.
  const tanda = (el: Element) => {
    const kelas = [...el.classList].find((c) => !/\d{3,}/.test(c))
    return el.tagName.toLowerCase() + (kelas ? `.${css(kelas)}` : '')
  }
  const daftar: HasilSurvei['daftar'] = []
  for (const induk of document.querySelectorAll('body *')) {
    if (induk.closest('table, [role=table], [role=grid]') || induk.children.length < 3 || !terlihat(induk)) continue
    const hitung = new Map<string, Element[]>()
    for (const anak of induk.children) {
      if (!teks(anak)) continue
      const t = tanda(anak)
      hitung.set(t, [...(hitung.get(t) ?? []), anak])
    }
    for (const [item, anak] of hitung) {
      if (anak.length >= 3 && teks(anak[0]).length > 3 && !daftar.some((d) => d.penanda === penanda(induk) && d.item === item))
        daftar.push({ penanda: penanda(induk), item, jumlah: anak.length, contoh: anak.slice(0, 3).map(teks) })
    }
  }
  daftar.sort((a, b) => b.jumlah - a.jumlah)

  const labelUntuk = (el: Element) => {
    const id = el.getAttribute('id')
    const lbl = id ? document.querySelector(`label[for="${css(id)}"]`) : el.closest('label')
    return teks(lbl) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || ''
  }
  const isian = [...document.querySelectorAll('input:not([type=hidden]), select, textarea, [contenteditable=true]')]
    .filter(terlihat)
    .slice(0, 30)
    .map((el) => ({
      label: labelUntuk(el),
      penanda: penanda(el),
      jenis: el.getAttribute('type') ?? el.tagName.toLowerCase(),
      // Values of password fields are never read.
      nilai: el.getAttribute('type') === 'password' ? '' : ((el as HTMLInputElement).value ?? '').slice(0, 40),
    }))

  const tombol = [...new Set([...document.querySelectorAll('button, [role=button], input[type=submit]')].filter(terlihat).map((b) => teks(b) || b.getAttribute('aria-label') || '').filter(Boolean))].slice(0, 30)

  const hitungAtribut = new Map<string, number>()
  for (const el of document.querySelectorAll('*'))
    for (const a of el.getAttributeNames())
      if (a.startsWith('data-') || a === 'aria-label' || a === 'name') hitungAtribut.set(a, (hitungAtribut.get(a) ?? 0) + 1)
  const atribut = [...hitungAtribut].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([a, n]) => `${a} (${n}×)`)

  return {
    halaman: location.origin + location.pathname,
    judul: document.title,
    waktu: Date.now(),
    bingkai: document.querySelectorAll('iframe').length,
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

export function laporanSurvei(h: HasilSurvei): string {
  return [
    'Laporan survei halaman dari Dashboard Otomasi',
    `Halaman: ${h.halaman}`,
    `Judul: ${h.judul}`,
    `Waktu: ${new Date(h.waktu).toLocaleString('id-ID')}`,
    ...(h.bingkai ? [`Catatan: halaman punya ${h.bingkai} iframe; isinya tidak ikut disurvei.`] : []),
    'Isi: struktur halaman dan paling banyak 3 contoh baris per daftar. Kata sandi tidak pernah dibaca.',
    '',
    JSON.stringify(h, null, 2),
  ].join('\n')
}
