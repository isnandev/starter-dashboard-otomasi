// `npm run cek`: checks the proof rules with plain Node (no browser, no test framework).
// If one of these fails, the dashboard could call a broken connection "terbukti".
import dasar from 'node:assert/strict'
import { bacaCsv, bandingkanTulisan, cekTulisan, JADWAL_CEK_TULISAN, keAngka, keTanggal, periksaBacaan, periksaBaris } from '../src/lib/periksa.ts'
import { samarkanTeks, sensorAngka, sensorBaris, sensorPerubahan, sensorSurvei, sensorTeks } from '../src/lib/sensor.ts'
import type { HasilSurvei } from '../src/lib/survei.ts'
import type { Baris, Tabel } from '../src/lib/types.ts'

// Counts every check, so the last line says how many passed.
let jumlah = 0
const assert = new Proxy(dasar, {
  get(t, k) {
    const f = Reflect.get(t, k)
    return typeof f === 'function'
      ? (...a: unknown[]) => {
          jumlah++
          return f(...a)
        }
      : f
  },
})

const s = { kunci: 'kode', kolom: [{ id: 'kode', label: 'Kode' }, { id: 'jumlah', label: 'Jumlah', jenis: 'angka' as const }] }

// A read is proven only with real rows.
assert.deepEqual(periksaBacaan(s, [{ kode: 'A1', jumlah: '3' }]), [])
assert.match(periksaBacaan(s, [])[0], /0 baris/)
assert.deepEqual(periksaBacaan({ ...s, bolehKosong: true }, []), [])
assert.match(periksaBacaan(s, undefined)[0], /bukan daftar/)
assert.match(periksaBacaan(s, [{ kode: 'A1', jumlah: '' }, { kode: 'A2' }])[0], /Jumlah.*kosong di semua baris/)
assert.match(periksaBacaan(s, [{ kode: '', jumlah: '1' }])[0], /kosong/)
assert.match(periksaBacaan(s, [{ kode: 'A1', jumlah: 1 }, { kode: 'A1', jumlah: 2 }])[0], /dua kali/)
assert.match(periksaBacaan(s, [{ kode: 'A1', jumlah: 'Habis' }])[0], /bukan angka/)

// Indonesian numbers.
assert.equal(keAngka('Rp 12.500'), 12500)
assert.equal(keAngka('1.234.567'), 1234567)
assert.equal(keAngka('12,5'), 12.5)
assert.equal(keAngka('1.234,5'), 1234.5)
assert.ok(Number.isNaN(keAngka('Habis')))

// Dates as owners write them (day first).
assert.equal(keTanggal('20/11/2026'), '2026-11-20')
assert.equal(keTanggal('2-8-2026'), '2026-08-02')
assert.equal(keTanggal('2026-11-20'), '2026-11-20')
assert.equal(keTanggal('31/02/2026'), null)
assert.equal(keTanggal('besok'), null)

// A write counts only when the page shows the new value when read again.
const p = [{ kunci: 'A1', kolom: 'jumlah', ke: 5 }, { kunci: 'A2', kolom: 'jumlah', ke: 7 }]
assert.deepEqual(bandingkanTulisan(p, [{ kode: 'A1', jumlah: '5' }, { kode: 'A2', jumlah: '7' }], 'kode'), [])
assert.deepEqual(bandingkanTulisan(p, [{ kode: 'A1', jumlah: '5' }, { kode: 'A2', jumlah: '9' }], 'kode').map((x) => x.kunci), ['A2'])
assert.deepEqual(bandingkanTulisan(p, [{ kode: 'A1', jumlah: '5' }], 'kode').map((x) => x.kunci), ['A2'])

// A write that landed but only shows after a refresh is NOT "gagal".
// (Module test 25 Nov: the page kept the old number until reloaded.)
{
  const tunggu: number[] = []
  const tidur = async (ms: number) => void tunggu.push(ms)
  const satu = [{ kunci: 'A1', kolom: 'jumlah', ke: 31 }]
  let halaman: Baris[] = [{ kode: 'A1', jumlah: '30' }] // stale until reloaded
  let dimuat = 0
  const h = await cekTulisan(satu, 'kode', {
    baca: async () => halaman,
    muatUlang: async () => {
      dimuat++
      halaman = [{ kode: 'A1', jumlah: '31' }]
    },
    tidur,
  })
  assert.deepEqual(h.belum, [])
  assert.equal(h.dimuatUlang, true)
  assert.equal(dimuat, 1)
  assert.deepEqual(h.baris, [{ kode: 'A1', jumlah: '31' }])

  // A read that fails while the page is still drawing is retried, not a failure.
  let ke = 0
  const h2 = await cekTulisan(satu, 'kode', {
    baca: async () => {
      if (++ke < 3) throw new Error('Kolom "Harga" kosong di semua baris')
      return [{ kode: 'A1', jumlah: 31 }]
    },
    tidur,
  })
  assert.deepEqual(h2.belum, [])
  assert.match(h2.catatan[0], /belum bisa dibaca/)

  // A write that never landed is still reported, after the reload.
  const h3 = await cekTulisan(satu, 'kode', { baca: async () => [{ kode: 'A1', jumlah: '30' }], muatUlang: async () => {}, tidur })
  assert.equal(h3.belum.length, 1)
  assert.equal(h3.dimuatUlang, true)

  // Without a reload (sambungan opted out) the reload step is skipped, not faked.
  const h4 = await cekTulisan(satu, 'kode', { baca: async () => [{ kode: 'A1', jumlah: '30' }], tidur })
  assert.equal(h4.dimuatUlang, false)
  assert.equal(h4.belum.length, 1)

  // No read worked at all: no rows, so the dashboard can't call it proven.
  const h5 = await cekTulisan(satu, 'kode', { baca: async () => { throw new Error('tab ditutup') }, tidur })
  assert.equal(h5.baris, undefined)
}

// Sensor: what is copied to the agent has no phone numbers, e-mails or names.
assert.equal(sensorTeks('WA 0812-3456-7890 ya'), 'WA [nomor HP] ya')
assert.equal(sensorTeks('+62 812 3456 7890'), '[nomor HP]')
assert.equal(sensorTeks('6281234567890'), '[nomor HP]')
assert.equal(sensorTeks('kirim ke contoh@tokokue-ani.id'), 'kirim ke [email]')
assert.equal(sensorTeks('NIK 3507012345678901'), 'NIK [angka panjang]')
// Prices, stock, dates and sizes keep their format.
assert.equal(sensorTeks('Rp 12.500 · stok 30 · 20/11/2026 · 250gr'), 'Rp 12.500 · stok 30 · 20/11/2026 · 250gr')
assert.equal(samarkanTeks('Bu Siti, 3 bks keripik 250gr'), 'B… S…, 3 b… k… 250gr')
assert.equal(samarkanTeks('Stok Habis', new Set(['stok'])), 'Stok H…')
{
  const survei: HasilSurvei = {
    halaman: 'https://web.contoh.id/chat',
    judul: 'Chat',
    waktu: 0,
    bingkai: 0,
    bagian: 'bagian utama halaman',
    judulBagian: ['Daftar Produk', 'Pengaturan Stok'],
    tabel: [{ penanda: 'table', baris: 'tr', sel: 'td', kolom: ['Nama', 'Stok'], isiSel: ['teks', 'teks'], jumlahBaris: 2, contoh: [['Ani Lestari', '30'], ['Pak Budi 081234567890', '2']] }],
    daftar: [{ penanda: 'div', item: 'div.pesan', jumlah: 5, contoh: ['Mbak, pesen 2 ya, kirim ke Jl. Melati 5', 'ok', 'Makasih kak'] }],
    isian: [{ label: 'Cari', penanda: 'input[name="q"]', jenis: 'text', nilai: 'Ani' }],
    tombol: ['Simpan perubahan', 'Ubah stok', 'Tambah produk', 'Telepon (021) 555 1234'],
    atribut: [],
  }
  const s = sensorSurvei(survei)
  const teks = JSON.stringify(s)
  for (const pribadi of ['Ani', 'Lestari', 'Budi', '081234567890', 'Melati', '555 1234']) assert.ok(!teks.includes(pribadi), `"${pribadi}" lolos sensor`)
  assert.equal(s.disensor, true)
  assert.deepEqual(s.tabel[0].kolom, ['Nama', 'Stok'])
  assert.equal(s.tabel[0].contoh[0][1], '30')
  assert.equal(s.isian[0].penanda, 'input[name="q"]')
  assert.equal(s.isian[0].label, 'Cari')
  // The page's own UI text stays readable: the agent builds selectors and tulis() from it.
  assert.deepEqual(s.tombol, ['Simpan perubahan', 'Ubah stok', 'Tambah produk', 'Telepon [nomor telepon]'])
  assert.deepEqual(s.judulBagian, ['Daftar Produk', 'Pengaturan Stok'])
}

// Dates, times and timestamps are not long numbers; landlines are censored.
for (const [masuk, keluar] of [
  ['2026-11-26', '2026-11-26'],
  ['2026-11-26 10:30', '2026-11-26 10:30'],
  ['2026-11-26T10:30:00', '2026-11-26T10:30:00'],
  ['26/11/2026 10:30', '26/11/2026 10:30'],
  ['26-11-2026 10.30', '26-11-2026 10.30'],
  ['waktu 1795000000000', 'waktu 1795000000000'], // Date.now() in ms
  ['Rp 12.500.000', 'Rp 12.500.000'],
  ['stok 120 300 450', 'stok 120 300 450'],
  ['rek 1234567890', 'rek [angka panjang]'],
  ['rek 123-456-7890', 'rek [angka panjang]'],
  ['NIK 3507 0123 4567 8901', 'NIK [angka panjang]'],
  ['(021) 555 1234', '[nomor telepon]'],
  ['telp 0341-551234', 'telp [nomor telepon]'],
  ['+62 21 555 1234', '[nomor HP]'],
] as const)
  assert.equal(sensorTeks(masuk), keluar, masuk)
assert.equal(sensorAngka(1795000000000), 1795000000000)
assert.equal(sensorAngka(3507012345678901), '[angka panjang]')
assert.equal(sensorAngka(12500), 12500)

// Failure reports: a name used as a row key doesn't reach the agent.
assert.deepEqual(
  sensorPerubahan(
    [{ kunci: 'Bu Siti', kolom: 'status', dari: 'Baru', ke: 'Dikirim', label: 'Bu Siti' }, { kunci: 'KR-07', kolom: 'stok', dari: 30, ke: 31 }],
    [{ id: 'status', label: 'Status', aman: true }, { id: 'stok', label: 'Stok', jenis: 'angka' }],
    'pelanggan',
  ),
  [{ kunci: 'B… S…', kolom: 'status', dari: 'Baru', ke: 'Dikirim', label: 'B… S…' }, { kunci: 'KR-07', kolom: 'stok', dari: 30, ke: 31 }],
)

// The page is reloaded only after it had time to finish a save (at least 8 s after tulis).
{
  const urutan: string[] = []
  await cekTulisan([{ kunci: 'A1', kolom: 'jumlah', ke: 1 }], 'kode', {
    baca: async () => [{ kode: 'A1', jumlah: '0' }],
    muatUlang: async () => void urutan.push('muat ulang'),
    tidur: async (ms) => void urutan.push(String(ms)),
  })
  const sebelum = urutan.slice(0, urutan.indexOf('muat ulang')).reduce((a, x) => a + Number(x), 0)
  assert.ok(sebelum >= 8000, `muat ulang setelah ${sebelum} ms`)
  assert.ok(JADWAL_CEK_TULISAN.some((l) => l.muatUlang && l.tenangDulu))
}
// Bukti rows: only `aman` columns keep their text; numbers stay.
assert.deepEqual(
  sensorBaris([{ produk: 'Keripik Balado 250gr', pembeli: 'Bu Siti', hp: '0812 3456 7890', stok: 30 }], [
    { id: 'produk', label: 'Produk', aman: true },
    { id: 'pembeli', label: 'Pembeli' },
    { id: 'hp', label: 'HP' },
    { id: 'stok', label: 'Stok', jenis: 'angka' },
  ]),
  [{ produk: 'Keripik Balado 250gr', pembeli: 'B… S…', hp: '[nomor HP]', stok: 30 }],
)

// Local tables: rows are checked against the columns.
const t: Tabel = {
  id: 'uji',
  nama: 'Uji',
  kunci: 'kode',
  asal: 'cek otomatis',
  kolom: [
    { id: 'kode', label: 'Kode', jenis: 'teks' },
    { id: 'jumlah', label: 'Jumlah', jenis: 'angka', wajib: true },
    { id: 'jenis', label: 'Jenis', jenis: 'pilihan', pilihan: ['a', 'b'] },
    { id: 'tgl', label: 'Tanggal', jenis: 'tanggal' },
  ],
}
assert.equal(periksaBaris(t, { kode: 'A1', jumlah: '2', jenis: 'a' }), null)
assert.match(periksaBaris(t, { kode: 'A1', jumlah: 'dua' }) ?? '', /harus angka/)
assert.match(periksaBaris(t, { kode: 'A1', jumlah: '2', jenis: 'c' }) ?? '', /salah satu/)
assert.deepEqual(bacaCsv('Kode;Jumlah;Jenis;Tanggal\nA1;1.200;a;20/11/2026\nA2;3;b;', t), [
  { kode: 'A1', jumlah: 1200, jenis: 'a', tgl: '2026-11-20' },
  { kode: 'A2', jumlah: 3, jenis: 'b' },
])
assert.match(periksaBaris(t, { kode: 'A1', jumlah: '2', tgl: '31/02/2026' }) ?? '', /harus tanggal/)
assert.throws(() => bacaCsv('kode,jumlah\nA1,1\nA1,2', t), /baris 3: "A1" sudah ada/)
assert.throws(() => bacaCsv('kode\nA1', t), /kolom "jumlah"/)

console.log(`cek logika: semua lulus (${jumlah} pemeriksaan)`)
