# Starter Dashboard Otomasi

Starter Chrome extension dengan satu dashboard untuk menjalankan otomasi
usaha apa pun: bengkel, klinik, tempat kursus, laundry, katering, jasa,
persewaan, toko online. Dibuat untuk dikembangkan oleh **AI coding agent**
(Claude Code, Codex, Antigravity) dari sebuah *rancangan otomasi*.

Dua hal yang jadi dasarnya:

- **Dashboard = tempat utama datamu.** Semua tabel usahamu tersimpan di
  komputermu sendiri (local-first). Tidak ada server, tidak ada akun yang perlu
  disetel, tidak ada yang dikirim ke internet.
- **Extension = jembatan ke halaman web.** Aplikasi atau situs yang kamu pakai
  (halaman penjual marketplace, aplikasi booking, WhatsApp Web, dan lainnya)
  disambungkan lewat halaman yang sudah kamu buka dan login di Chrome. Tanpa
  API key dan tanpa setting Google.

Dan satu aturan: **tidak ada yang dianggap jalan tanpa bukti.** Sambungan baru
berstatus "Terbukti tersambung" kalau data asli benar-benar terbaca dari
halamannya, lengkap dengan contoh barisnya untuk kamu cocokkan. Setiap
perubahan yang ditulis ke halaman dibaca ulang untuk memastikan perubahannya
benar-benar tersimpan.

Dashboard mulai kosong dan menulis "Belum ada …". Tidak ada data contoh, jadi
semua yang muncul pasti datamu sendiri.

## Cara pakai dengan AI coding agent

1. Ambil starter ini ke komputermu. Paling mudah, tempel ini ke agent-mu:
   > Ambil starter github.com/isnandev/starter-dashboard-otomasi ke folder baru
   > bernama tools-otomasi. Kalau git tidak ada di komputerku, unduh ZIP-nya
   > lalu ekstrak. Setelah itu jalankan npm install dan npm run build.

   Tanpa agent: tombol **Code → Download ZIP** di GitHub, lalu ekstrak. Tidak
   perlu git.
2. Buka foldernya di agent-mu.
3. Tempel rancangan otomasimu, lalu tulis:
   > Bangun rancangan ini di atas starter ini. Ikuti AGENTS.md.
4. Agent akan:
   - **meminta contoh datamu** (file Excel/CSV, foto buku catatan, atau
     screenshot) sebelum membuat tabel. Belum punya catatan? Agent memberi
     rekomendasi kolom untuk kamu setujui;
   - **meminta survei halaman** sebelum membuat sambungan: buka halamannya,
     login, lalu di dashboard tekan **Sambungan → Survei halaman ini** dan
     salin hasilnya ke agent;
   - **meminta bukti** dari dashboard (Tes sambungan, Coba dulu) sebelum
     menyebut sesuatu selesai.

Aturan untuk agent ada di [AGENTS.md](AGENTS.md). Claude Code membaca
`CLAUDE.md`, yang menunjuk ke file yang sama.

Skill yang sudah disertakan di `.claude/skills/`:
- **bangun-dari-rancangan:** membangun rancanganmu langkah demi langkah:
  contoh data → tabel → survei → sambungan → bukti → otomasi.
- **semantic-debugging:** mencari penyebab masalah dari laporanmu, termasuk
  saat tampilan halaman web berubah.
- **react-best-practices:** dari Vercel (lisensi MIT), supaya kode React-nya
  rapi.

## Memasang di Chrome

1. Jalankan `npm install`, lalu `npm run build`. Hasilnya ada di folder `dist`.
2. Buka `chrome://extensions` dan nyalakan **Developer mode** (sekali saja).
3. Klik **Load unpacked**, lalu pilih folder `dist`.
4. Dashboard terbuka otomatis. Untuk membukanya lagi, klik ikon extension.

Setiap kali agent mengubah kode: jalankan `npm run build`, lalu tekan ikon
muat ulang pada extension di `chrome://extensions`.

## Lima halaman dashboard

| Halaman | Isinya |
|---|---|
| Beranda | Status satu kalimat, otomasi, Coba dulu / Jalankan sekarang, Perlu perhatian, Perlu dicek |
| Data | Tabel usahamu: tambah, ubah, hapus, impor CSV, unduh format CSV, buat cadangan |
| Sambungan | Kartu tiap sambungan dengan buktinya, Tes sambungan, Survei halaman web |
| Riwayat | Semua kegiatan dengan bahasa biasa, plus tombol salin laporan/bukti/survei untuk agent |
| Pengaturan | Nama usaha, jadwal, tampilan, pulihkan cadangan, hapus semua data |

## Batas yang perlu diketahui

- Otomasi hanya jalan selama Chrome terbuka.
- Kalau tampilan halaman web berubah, sambungan bisa berhenti. Dashboard akan
  menulis "Berhenti" dan alasannya. Survei ulang halamannya, salin laporan
  dari Riwayat, lalu minta agent memperbaikinya.
- Cek syarat dan ketentuan tiap situs soal otomasi halamannya.
- Data hanya ada di komputer ini: buat cadangan seminggu sekali (Data → Buat
  cadangan).

## Untuk pengembang

- `npm run build`: cek tipe dan build ke `dist`.
- `npm run cek`: cek aturan bukti (`src/lib/periksa.ts`) dengan Node saja.
- `npm run dev`, lalu buka `http://localhost:5173/dashboard.html` untuk melihat
  tampilannya (sambungan dan survei hanya jalan di extension yang terpasang).

Teknologi: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, IndexedDB
(`idb`), Chrome Extension Manifest V3.
