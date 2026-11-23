---
name: semantic-debugging
description: >-
  Debugs by meaning instead of by guessing. It starts from what the owner sees
  and what they expected, traces that through the dashboard, the automation,
  the sambungan, the web page and the local data, fixes the cause, and proves
  the fix from the dashboard. It also makes page automation robust with
  semantic selectors (roles, labels, visible text) and a fresh page survey
  instead of brittle CSS classes. Use this whenever something in the extension
  or dashboard is wrong or stopped: a "Berhenti" status, "Belum tersambung", a
  pasted "Laporan masalah dari Dashboard Otomasi", wrong numbers, a page that
  "changed", a connection that reads nothing, or any bug report from the owner.
---

# Semantic debugging

The owner is not technical. Their report describes **meaning** ("pengingat
untuk Pak Budi tidak muncul", "angka di aplikasi booking tidak ikut berubah"),
not code. Debug in that language first, then go to code. Don't change code
until you can say in one sentence why the bug happens.

## 1. Pin down meaning: seen vs expected

Write down, in the owner's words:
- **Seen:** what the dashboard or page shows (status, history line, number).
- **Expected:** what should have happened.
- **Where and when:** which sambungan, which row, which time (history lines
  have times).

The "Salin laporan untuk agent" report already has the seen part, the steps
that ran and the technical details. If "expected" is missing, ask one
question with an example. Reproduce with "Coba dulu" or "Tes sambungan"
whenever you can: they change nothing.

## 2. Trace the meaning through the system

Follow the thing that is wrong, layer by layer, and check each layer against
what it *should* mean:

1. **Dashboard text** → which state produces it (`statusUmum` in
   `src/lib/mesin.ts`, the history entry, the sambungan card).
2. **Automation** (`src/otomasi/*.ts`) → which step or rule wrote that state.
3. **Proof layer** (`src/lib/sambungan.ts`, `src/lib/periksa.ts`) → what was
   read, what `periksaBacaan` said, what the re-read after a write showed.
4. **Sambungan** (`src/sambungan/*.ts`) → which selectors it used.
5. **The page itself** → does the element still exist? Does it still mean the
   same thing (same label, same column, same tab of the page)?
6. **Local data** (`src/lib/db.ts`) → is the stored value what the rules
   expect (keys match between page and table, numbers are numbers)?

At the first layer where meaning diverges ("the page now labels the column
*Sisa kuota*, the selector still reads the old input name"), you've found
the cause. Write it in one sentence before fixing it.

## 3. When a page changed: survey again, don't guess

Most "it stopped" bugs come from a page that changed. Ask the owner for a
**new survey** of that page (Sambungan → Survei halaman ini → Salin hasil
survei untuk agent) and a screenshot. Compare it with the survey named in the
sambungan's `survei` field, update the selectors from the new survey, and
update `survei`.

Make selectors survive change by targeting meaning, in this order:
1. **Accessible role + name:** a button whose text is "Simpan", an input whose
   label is "Jumlah".
2. **Visible text nearby:** find the row by its key (code, name, phone), then
   the cell under the right header.
3. **Stable attributes:** `data-*`, `name`, `aria-label`.
4. **CSS classes last:** generated names (`.css-1x2y3z`) break on the next
   deploy.

Keep all selectors in the sambungan's `SELECTOR` object with a comment on what
each one *means*.

## 4. Fix the cause, then prove it

- Make the smallest change that fixes the cause. Don't rewrite working parts.
- Never "fix" by hiding the failure: don't catch errors to show success, don't
  return `[]` or a default value when a read fails, don't loosen
  `periksaBacaan`. A wrong number must become a clear "Berhenti", never a
  quiet success.
- Build (`npm run build`, plus `npm run cek` if `periksa.ts` changed) and ask
  the owner to reload the extension.
- **Prove it from the dashboard:** the owner presses "Tes sambungan" or "Coba
  dulu" and sends you the result (the copied proof or the history line). The
  fix is done only when that shows what they expected. Until then, say
  "sudah saya ubah, belum terbukti".
- Close with one or two sentences in Bahasa Indonesia: what was wrong (in
  meaning, not code), what you changed, and the proof you saw.

## Common causes in this starter

| Symptom on the dashboard | Usual cause |
|---|---|
| "Halamannya belum dibuka" while the tab is open | `pola` doesn't match the page's real URL (another subdomain or path) |
| "Extension belum diberi izin membuka halaman ini" | `pola` missing from `host_permissions`, or the extension wasn't reloaded |
| "Daftar data tidak ditemukan" | logged out, a different tab/view of the page, or the list container changed: survey again |
| "Kolom … kosong di semua baris" | the column selector no longer matches (renamed input, moved column): survey again |
| "… bukan angka" | the page shows text ("Habis", "Rp 12.500 / pcs"); parse it with `keAngka` or read another element |
| "… terbaca dua kali" | the row selector also matches a header, footer or a nested row |
| "… perubahan tidak terlihat di halaman setelah disimpan" | the value was set without the native setter + input event, the save button wasn't pressed, or the page rejected the value |
| Numbers jump or double | the same page row was counted on two runs; compare against the local table instead of adding |
| Nothing happens on schedule | Chrome was closed, automations are paused, the automation isn't `terjadwal`, or test mode is on |
