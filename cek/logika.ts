// `npm run cek`: checks the proof rules with plain Node (no browser, no test framework).
// If one of these fails, the dashboard could call a broken connection "terbukti".
import assert from 'node:assert/strict'
import { bacaCsv, bandingkanTulisan, keAngka, keTanggal, periksaBacaan, periksaBaris } from '../src/lib/periksa.ts'
import type { Tabel } from '../src/lib/types.ts'

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

console.log('cek logika: semua lulus')
