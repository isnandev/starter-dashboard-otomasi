---
name: bangun-dari-rancangan
description: >-
  Builds a business owner's RANCANGAN OTOMASI (the 13-field automation design
  from the rancangan-otomasi skill) into this Chrome-extension dashboard
  starter, for any kind of business (service, clinic, course, workshop, shop,
  rental...). Asks for the owner's sample data before making any table,
  surveys each real web page with the extension before making any connection,
  and only calls a step done with proof from the dashboard. Use this whenever
  the user pastes a block starting with "RANCANGAN OTOMASI", or asks to
  "bangun", "buatkan tools", or "jadikan extension" from a rancangan or from a
  description of a business automation (reminders, follow-ups, syncing data
  between web apps, alarms, reports, stock), even if they don't name the skill.
---

# Bangun dari rancangan

The owner is not technical. They pasted a **RANCANGAN OTOMASI** and want a
tool that works for *their* business. Build it on this starter so it keeps
its promises: the dashboard is the main storage (local-first), the extension
is the bridge to web pages (sambungan), no API keys, formulas instead of AI
inside the tool, and **nothing is called done without proof**. Read
`AGENTS.md` first; its rules apply to everything below.

Don't assume the business is a shop. Take its nouns from the rancangan and
the owner's own data: a workshop has *servis* and *kendaraan*, a course has
*murid* and *tagihan*, a clinic has *pasien* and *jadwal kontrol*.

## 0. Make sure the project folder is ready

Check this quietly before step 1, and only tell the owner what they must do.

- **The starter is here** when the folder has `AGENTS.md` and a
  `package.json` named `starter-dashboard-otomasi`. If it isn't (the skill was
  installed on its own, or the owner is in an empty folder), get it into a new
  folder `tools-otomasi`:
  - Run `git --version`. If it works:
    `git clone https://github.com/isnandev/starter-dashboard-otomasi.git tools-otomasi`.
  - **If git is missing, don't ask the owner to install it.** Download the ZIP
    and extract it instead:
    - URL: `https://github.com/isnandev/starter-dashboard-otomasi/archive/refs/heads/main.zip`
    - Windows (PowerShell): `Invoke-WebRequest -Uri <URL> -OutFile starter.zip`,
      then `Expand-Archive starter.zip -DestinationPath .`
    - macOS / Linux: `curl -L -o starter.zip <URL>`, then `unzip starter.zip`
      (or `tar -xf starter.zip`, which also works on Windows 10 and later).
    - The ZIP extracts to `starter-dashboard-otomasi-main/`. Rename it to
      `tools-otomasi`, delete `starter.zip`, and work inside `tools-otomasi`.
- **A folder from a ZIP has no `.git`.** That is fine. Don't run git commands
  that need a repository. For a checkpoint before a big change, copy the
  changed files to a `cadangan-kode/` folder.
- **Node.js is needed** for `npm install` and `npm run build`. If
  `node --version` fails, ask the owner to install the LTS version from
  nodejs.org (the one install this needs), then continue.
- Run `npm install`, `npm run cek` and `npm run build` once, so the owner can
  load `dist` in Chrome (Developer mode → Load unpacked → `dist`).

## 1. Read the rancangan and write the plan

Write the owner a short plan in Bahasa Indonesia (5–8 lines): what you will
build, in which order, and what you need from them (sample data, surveys).
Map each field to the starter:

| Rancangan field | Where it goes |
|---|---|
| Data yang dipakai | tables in `src/data/tabel.ts`, **after step 2's sample data** |
| Tempat / aplikasi | one sambungan per page in `src/sambungan/`, **after step 3's survey** |
| Pemicu (jadwal) | `terjadwal: true` on the automation; the interval is in Pengaturan |
| Pemicu (kejadian) | each scheduled run reads the sambungan and compares with the local table |
| Langkah / Aturan / kondisi | the automation's file in `src/otomasi/`, one `k.catat()` line per step that matters |
| Peran AI | a formula or `isiTemplate()` in the automation's file (no AI inside the tool) |
| Hasil | `k.data.simpan()` (local) and/or `k.tulis()` (a page, re-read to prove it) |
| Batas aman | checks before writing; test mode and confirmations are built in |
| Alarm | `k.alarm()` → "Perlu perhatian" + a Chrome notification |
| Dicek manusia | `k.perluDicek()` → a draft on Beranda; never sent automatically |
| Ukuran berhasil | numbers the dashboard can count: rows in a table, history lines |

If a field is missing or unclear, ask **one** question at a time, with an
example answer from their kind of business. If something needs an API key, a
cloud service or AI inside the tool, explain the starter's alternative in one
sentence (a page they are logged in to, local data, a formula) and continue.

Content and chat automation (posting schedules, comment → DM, WhatsApp
auto-replies) is not built here: tell the owner it belongs in Wicara.

## 2. Data: sample first, then the table

For each table in "Data yang dipakai":
1. **Ask for a sample of their own data** before writing any column: a file
   (Excel/CSV/Sheet), a screenshot of what they use now, a photo of their
   notebook, or a few rows typed in chat. A few real rows are enough.
2. Propose the columns from the sample as a short table (label, type: teks /
   angka / tanggal / pilihan, which column identifies a row). Keep their
   words. Wait for their OK.
3. **No sample?** Recommend columns that fit their business and the
   rancangan, say clearly it is a recommendation, and wait for their OK or
   changes.
4. Add the table to `src/data/tabel.ts` with `asal` saying which of the two it
   came from. Never put data rows in code.
5. Build. **Proof:** the owner imports their file (Data → Unduh format CSV,
   fill it, Impor) or types rows, and tells you the row count shown. It must
   match their file.

## 3. Sambungan: survey first, then build, then prove

For each page in "Tempat / aplikasi", one at a time:
1. **Survey.** Ask the owner to open the page in Chrome and log in, then
   Sambungan → Survei halaman web → "Survei halaman ini", and paste "Salin
   hasil survei untuk agent" plus a screenshot.
2. **Build only from the survey** (AGENTS.md, "Adding a sambungan"). Name the
   survey in the `survei` field. Missing something? Ask for a survey of that
   view (another tab, after scrolling, outside an iframe). Never guess.
3. **Prove it.** The owner presses "Tes sambungan". Done only when the card
   shows **Terbukti tersambung**, the owner says the sample rows match the
   page, and the pasted "Salin bukti untuk agent" has real values in every
   column. "Belum tersambung" or a doubtful sample means: fix with the
   semantic-debugging skill and test again.

## 4. Automations, then "Coba dulu"

1. Only when its tables hold the owner's rows and its sambungan are proven.
2. Copy `src/otomasi/kerangka.ts`, follow its field map, register it.
3. **Prove it.** The owner presses "Coba dulu (tidak mengubah apa pun)" and
   reads each line ("Pak Budi: servis berikutnya 2 Des", "Kaos hitam di
   Marketplace A: stok 12 → 10 (akan diubah)"). Ask them: is every line what
   you expected? Fix until yes, with no error.
4. Schedule, alarms and drafts: check that the next run time shows, an alarm
   case shows "Perlu perhatian", and a draft appears under "Perlu dicek".

Keep every operation on the dashboard: an automation gets its status, history
lines, button and pause behaviour from the starter; don't run anything outside
it. Use the existing shadcn components and theme tokens; follow the
react-best-practices skill for React code.

**Never add sample, placeholder or dummy data** anywhere the owner can see
it. Empty means `BelumAdaData` with the one next step.

## 5. Hand over, with the proof

When it works in test mode, report in Bahasa Indonesia in this shape, quoting
real numbers and rows from what the owner sent you:

```
Sudah terbukti:
- Tabel Pelanggan: 48 baris dari file kamu.
- Sambungan "Aplikasi booking · jadwal": terbukti 10.15, 12 baris, contoh: 23/11 · Bu Sari · Facial.
- Coba dulu: 3 pengingat akan dibuat, sesuai yang kamu cek.

Belum terbukti:
- Mengubah data di halaman: baru terbukti setelah kamu menjalankan sungguhan.

Yang perlu kamu lakukan:
- Biarkan mode uji beberapa hari, cek Riwayat.
- Kalau sudah yakin: Beranda → Mulai jalan sungguhan → Jalankan sekarang.
- Buat cadangan seminggu sekali (Data → Buat cadangan).
- Kalau berhenti: Riwayat → Salin laporan untuk agent, tempel di sini.
```

Never write "selesai", "sudah tersambung" or "berhasil" for anything in the
"Belum terbukti" list. Never turn test mode off yourself, and never act on a
real account without the owner's explicit OK in the conversation.
