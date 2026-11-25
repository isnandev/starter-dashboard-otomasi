# Instruksi untuk AI coding agent

This repository is a starter for a **Chrome extension (Manifest V3) with one
dashboard** that runs the automations of a small business, any kind of
business: a workshop, a clinic, a course, a laundry, a caterer, an agency, a
rental, an online shop. The person you work with owns or runs that business
and is **not technical**. They usually paste a "RANCANGAN OTOMASI" (13 fields)
and ask you to build it.

The starter is built on two ideas. Keep both.

1. **The dashboard is the main storage (local-first).** The business's tables
   live in IndexedDB on the owner's computer (`src/lib/db.ts`), defined in
   `src/data/tabel.ts`. No cloud, no server, no Google Sheets as the database.
2. **The extension is the bridge (sambungan).** Outside services are reached
   through web pages the owner already has open and is logged in to
   (marketplace seller pages, booking sites, web apps, WhatsApp Web...). One
   file per page in `src/sambungan/`. A page is read from or written to; it is
   never where the data lives.

## Proof before "done" (the most important rule)

A build that passes, code that looks right, a login marker on the page, an
empty list or "no error" is **not** proof. The owner can't check code, so they
believe what you say. Never tell them something works until you have proof:

| What you built | Proof you need before you say it works |
|---|---|
| A table | The owner imported or typed **their own** rows; the Data screen shows them and the count matches their file. |
| A sambungan | "Tes sambungan" on the Sambungan screen shows **Terbukti tersambung** with N rows, the owner says the sample rows match what they see on the page, and they pasted "Salin bukti untuk agent" to you. Check the pasted rows yourself: real values, the right columns, the right types, N plausible for that page. |
| Writing to a page | A real run shows "(sudah dicek di halaman)" on the change lines: the dashboard re-read the page after saving. |
| An automation | "Coba dulu" lists what the owner expected, in their words, with no error; later a real run with no error. |

When you report, quote the proof (numbers, sample rows, history lines) and
list separately what is **not proven yet**. If you can't get the proof now,
say "belum terbukti" and what the owner must do to get it. Never write
"sudah tersambung", "berhasil" or "selesai" for something unproven.

The code enforces part of this: `src/lib/sambungan.ts` only marks a
sambungan "terbukti" after `periksaBacaan` accepts real rows, and re-reads the
page after every write. Never weaken those checks, never catch their errors
to show success, and never return `[]` or a default value when reading fails:
throw (or return `{ galat }` from inside the page) so the dashboard shows it.

## Before making a table: ask for sample data

Don't design columns from the rancangan alone. First ask the owner for a
**sample of their own data**, so the table fits how they really work:
- a file (Excel, CSV, a downloaded Google Sheet), a screenshot of the app or
  form they use now, a photo of their notebook, or a few rows typed in chat;
- a few real rows are enough. Say why: "supaya kolomnya sesuai catatanmu".

From the sample, propose the columns as a short table (label, type, which one
identifies a row) and wait for the owner's OK. Keep their names for things.

**If they have no records yet**, recommend columns that fit their kind of
business and the rancangan (say they are a recommendation), and wait for their
OK or changes. Never invent data rows: the sample is for the structure. The
owner fills the table themselves (CSV import or typing in the Data screen).

Write where the columns came from in the table's `asal` field, e.g.
`'contoh dari pemilik: servis-oktober.xlsx (23 Nov 2026)'` or
`'rekomendasi agent, disetujui pemilik 23 Nov 2026'`.

Set `bolehKosong: true` on tables that fill up over time (pesanan, booking
masuk, stok masuk). They are empty on day one, and the Beranda shouldn't call
that a problem. Tables the owner fills first (produk, stok, pelanggan) stay
without it, so an empty one is flagged.

## Before making a sambungan: survey the real page

Never guess a URL, a selector or a column of a page you haven't seen. For
every page in the rancangan's "Tempat / aplikasi":
1. Ask the owner to open that page in Chrome and log in, then go to
   **Sambungan → Survei halaman web → Survei halaman ini** and paste
   **Salin hasil survei untuk agent** to you, with a screenshot of the page.
   The survey covers only the part the owner highlighted, an open dialog, or
   the page's main area (its "Yang disurvei" line says which). If it covers
   the wrong part, ask the owner to highlight a little text from two rows of
   the right list and survey again.
2. Build only from the survey: its tables, repeated lists, form fields,
   buttons and attributes. Write the survey you used in the sambungan's
   `survei` field. Its sample rows are **censored** (names and chat text
   become first letters, phone numbers become `[nomor HP]`); numbers, prices,
   dates and codes are real. Never ask the owner for the uncensored text of a
   page with customer data: build from the structure.
   In the sambungan's `kolom`, set `aman: true` only on columns that never hold
   personal data (product name, price, stock, status). Names, phone numbers,
   addresses and chat text stay unmarked, so they are censored in the bukti
   and laporan the owner copies to you.
3. If what you need isn't in the survey (another tab of the page, a list that
   only shows after scrolling or filtering, content inside an iframe), ask for
   a survey of that view. Don't fill gaps with guesses.
4. Add the page's `pola` to `host_permissions` in `public/manifest.json`.
5. Get the proof: owner presses **Tes sambungan** (see the table above).

If you have your own browser tool that can open the page, you may look at it
too, but the proof still comes from the owner's dashboard.

## How to work with the owner
- Talk in **Bahasa Indonesia**: short sentences, no jargon. Explain what you
  are doing as if to a business owner, not a developer.
- Work in **small steps**. After each step, tell them exactly what to check in
  the dashboard and what proof to send back.
- Ask before anything risky: deleting data, changing many files, or acting on
  a real account (writing to a live page).
- When something breaks, ask for the report from the dashboard ("Salin
  laporan untuk agent" in Riwayat) and a screenshot.
- After every change, run `npm run build` (and `npm run cek` if you touched
  `src/lib/periksa.ts`). Then tell the owner to open `chrome://extensions` and
  press the reload icon on the extension.
- **Don't assume git.** This folder may come from the ZIP download
  (`starter-dashboard-otomasi-main`) and have no `.git`. Never make the owner
  install or set up git (steps in
  `.claude/skills/bangun-dari-rancangan/SKILL.md`, section 0).

## Skills in this repository
They are in `.claude/skills/`. Claude Code loads them automatically. If your
agent doesn't, open the matching `SKILL.md` yourself when the task fits:

| Skill | Use it when |
|---|---|
| `bangun-dari-rancangan` | The owner pastes a "RANCANGAN OTOMASI" or asks to build a business automation |
| `semantic-debugging` | Something is wrong or stopped: a "Berhenti" status, a pasted report, wrong numbers, a page that changed |
| `react-best-practices` | Writing or reviewing React code (from Vercel; see its `SOURCE.md` for which rules apply here) |

## Fixed decisions (don't change without asking)
- **No API keys, OAuth, Google Cloud** or any setup the owner has to
  configure. Outside services go through a sambungan.
- **Local-first.** Keep CSV import, row editing and backup/restore (JSON)
  working for every table.
- **No AI inside the extension.** "Peran AI" from the rancangan becomes
  formulas and text templates (`isiTemplate` in `src/lib/utils.ts`) in the
  automation's file. You (the agent) are the AI.
- **Every operation is visible and controllable from the dashboard:** status,
  history lines, buttons, pause. Nothing runs that the dashboard doesn't show.
- **Test mode first.** "Coba dulu" changes nothing. "Mulai jalan sungguhan"
  only unlocks after a test run without errors. Never turn test mode off
  yourself.
- **No sample, placeholder or dummy data, ever.** No example rows, fake
  customers or orders, simulated sambungan, "Contoh"/"Demo" names or
  pre-filled fields. A beginner can't tell them apart from their real data.
  Empty means `BelumAdaData` ("Belum ada …" plus the one next step). Data only
  comes from the owner's import, their real pages, or what they type.
- **Drafts are never sent automatically.** "Dicek manusia" becomes
  `k.perluDicek()`: the owner reads, copies and sends it themselves.

## Dashboard UX rules (beginners first)
1. **Status in one sentence** at the top: Semua aman / Perlu perhatian /
   Berhenti. Colour **plus** an icon and words, never colour alone.
2. **One big button per action, named with a verb** ("Coba dulu", "Jalankan
   sekarang", "Buat cadangan", "Tes sambungan"). A pause switch: "Jeda semua
   otomasi".
3. **History in plain language**, newest on top: "10.15 · 3 booking baru
   dibaca dari aplikasi booking".
4. **Errors say what happened and what to do,** with one button. Technical
   details only go into the copied report. No error codes or jargon on screen.
5. **Sambungan as cards** with their proof: state, rows read, sample rows.
6. **Confirm before overwriting or deleting**, and offer a backup first.
7. A **first-run guide** in 3 steps: data → proven sambungan → test run.
8. Bahasa Indonesia, 16px base text, few screens (Beranda, Data, Sambungan,
   Riwayat, Pengaturan), safe defaults.

## Map of the code
| Path | What it is |
|---|---|
| `src/data/tabel.ts` | The business's tables (empty at the start). Add them after the sample-data step |
| `src/sambungan/` | One file per connected page, registered in `index.ts` (empty at the start). `kerangka.ts` = skeleton, never registered as-is |
| `src/otomasi/` | One file per automation, registered in `index.ts` (empty at the start). `kerangka.ts` maps the 13 rancangan fields |
| `src/lib/sambungan.ts` | Proof: `bacaTerbukti`, `tulisTerbukti`, `tesSambungan`. Every read/write goes through here |
| `src/lib/periksa.ts` | Pure checks (rows, CSV, reads, writes, Indonesian numbers). Tested by `npm run cek` |
| `src/lib/survei.ts` | "Survei halaman": what is on a page, for building a sambungan |
| `src/lib/mesin.ts` | Runs automations (buttons and schedule), test mode, alarms, drafts, the status sentence |
| `src/lib/db.ts` | Local database (IndexedDB), backup/restore |
| `src/background.ts` | Schedule (chrome.alarms) and notifications |
| `src/pages/` | Beranda, Data, Sambungan, Riwayat, Pengaturan |
| `src/components/belum-ada-data.tsx` | Empty state used instead of any sample data |
| `public/manifest.json` | Extension manifest. Add each sambungan's `pola` to `host_permissions` |
| `src/components/ui/` | shadcn/ui components (don't edit by hand; add with `npx shadcn@latest add <name>`) |
| `src/index.css` | Theme tokens (light + dark). Use the tokens, not raw colours |
| `cek/logika.ts` | `npm run cek`: the proof rules, checked with plain Node |

## Adding a sambungan
1. Survey first (section above). No survey, no sambungan.
2. Copy `src/sambungan/kerangka.ts` to `src/sambungan/<id>.ts`. Fill
   `SELECTOR`, `pola`, `halaman`, `kunci`, `kolom` and `survei` from the
   survey. Prefer semantic selectors (role, aria-label, header text, data-*,
   name); see the semantic-debugging skill.
3. `baca` throws (or returns `{ galat }` from inside the page) when the list
   isn't on the page. `[]` only means "the list is there and empty", and only
   with `bolehKosong: true`.
4. Add `pola` to `host_permissions` in `public/manifest.json`, register the
   sambungan in `src/sambungan/index.ts`, build.
5. Proof: Tes sambungan → Terbukti tersambung → owner confirms the sample rows
   and pastes the copied proof to you.
6. Remind the owner to check that site's terms on automating its pages.

## Adding an automation
1. Its tables exist and hold the owner's rows; every sambungan it uses is
   proven.
2. Copy `src/otomasi/kerangka.ts`, map the rancangan onto it, register it in
   `src/otomasi/index.ts`. Use only table, column and sambungan ids that exist.
3. Proof: the owner presses "Coba dulu" and confirms each line.
