import { tabel as semuaTabel } from '@/data/tabel'
import { otomasi as semuaOtomasi } from '@/otomasi'
import type { Konteks } from '@/otomasi/types'
import { sambungan as semuaSambungan } from '@/sambungan'
import { ambil, pengaturan, semuaBaris, simpan, simpanBaris, tambahRiwayat } from './db'
import { periksaBaris, rapikanBaris } from './periksa'
import { GagalSambungan, bacaTerbukti, cariSambungan, semuaStatusSambungan, tulisTerbukti } from './sambungan'
import type { Alarm, HasilJalan, HasilOtomasi, PerluDicek, StatusUmum } from './types'

// Runs the automations. Used by the dashboard ("Coba dulu", "Jalankan
// sekarang") and by the background worker (the schedule). Every run goes to
// the history in plain language, so the dashboard always shows what happened.

function cariTabel(id: string) {
  const t = semuaTabel.find((x) => x.id === id)
  if (!t) throw new Error(`Tabel "${id}" tidak ada di src/data/tabel.ts`)
  return t
}

export async function jalankan({ uji, hanya }: { uji: boolean; hanya?: 'terjadwal' | string }): Promise<HasilJalan | null> {
  const daftar = semuaOtomasi.filter((o) => !hanya || (hanya === 'terjadwal' ? o.terjadwal : o.id === hanya))
  if (!daftar.length) return null
  const waktu = Date.now()
  const hasil: HasilJalan = { uji, waktu, otomasi: [] }
  let alarm = await ambil<Alarm[]>('alarm', [])
  const draf = await ambil<PerluDicek[]>('perlu-dicek', [])

  for (const o of daftar) {
    const detail: string[] = []
    const alarmBaru: Alarm[] = []
    const k: Konteks = {
      uji,
      data: {
        semua: (t) => semuaBaris(cariTabel(t).id),
        async simpan(t, baris) {
          const tabel = cariTabel(t)
          for (const b of baris) {
            const salah = periksaBaris(tabel, b)
            if (salah) throw new Error(`Data untuk ${tabel.nama} belum benar: ${salah}`)
          }
          if (!uji) await simpanBaris(tabel, baris.map((b) => rapikanBaris(tabel, b)))
          detail.push(`${baris.length} baris ${uji ? 'akan disimpan' : 'disimpan'} ke ${tabel.nama}`)
        },
      },
      async baca(id) {
        const s = cariSambungan(id)
        const { baris } = await bacaTerbukti(s)
        detail.push(`${baris.length} baris dibaca dari ${s.nama}`)
        return baris
      },
      async tulis(id, perubahan) {
        const s = cariSambungan(id)
        if (!uji) await tulisTerbukti(s, perubahan)
        for (const p of perubahan)
          detail.push(`${p.label ?? p.kunci} di ${s.nama}: ${p.kolom} ${p.dari ?? '?'} → ${p.ke}${uji ? ' (akan diubah)' : ' (sudah dicek di halaman)'}`)
      },
      catat: (b) => void detail.push(b),
      alarm: (kunci, pesan) => void alarmBaru.push({ kunci, otomasi: o.id, pesan, waktu }),
      perluDicek(judul, isi) {
        const id = `${o.id}:${judul}`
        if (uji) detail.push(`Draf untuk dicek: ${judul}`)
        else if (!draf.some((d) => d.id === id)) draf.push({ id, otomasi: o.id, judul, isi, waktu })
      },
    }

    const h: HasilOtomasi = { id: o.id, nama: o.nama, berhasil: true, ringkas: '', detail }
    hasil.otomasi.push(h)
    try {
      h.ringkas = await o.jalankan(k)
    } catch (e) {
      h.berhasil = false
      // A sambungan failure is already in the history, with its report.
      if (e instanceof GagalSambungan) {
        h.ringkas = e.status.pesan
        continue
      }
      h.ringkas = `berhenti: ${e instanceof Error ? e.message : String(e)}`
      await tambahRiwayat({
        jenis: 'galat',
        ringkas: `${uji ? 'Uji coba · ' : ''}${o.nama} ${h.ringkas}`,
        detail,
        teknis: JSON.stringify(
          { otomasi: o.id, uji, langkahTerakhir: detail.slice(-5), galat: e instanceof Error ? `${e.name}: ${e.message}\n${e.stack ?? ''}` : e },
          null,
          2,
        ),
      })
      continue
    }

    if (uji) {
      for (const a of alarmBaru) detail.push(`Alarm: ${a.pesan}`)
    } else {
      const lama = new Set(alarm.filter((a) => a.otomasi === o.id).map((a) => a.kunci))
      for (const a of alarmBaru) if (!lama.has(a.kunci)) await tambahRiwayat({ jenis: 'alarm', ringkas: a.pesan })
      alarm = [...alarm.filter((a) => a.otomasi !== o.id), ...alarmBaru]
    }
    await tambahRiwayat({ jenis: uji ? 'uji' : 'otomasi', ringkas: `${uji ? 'Uji coba · ' : ''}${o.nama}: ${h.ringkas}`, detail })
  }

  if (!uji) {
    await simpan('alarm', alarm)
    await simpan('perlu-dicek', draf)
  }
  await simpan(uji ? 'hasil-uji' : 'hasil-terakhir', hasil)
  return hasil
}

/** The one-sentence status at the top of the dashboard. */
export async function statusUmum(): Promise<StatusUmum> {
  const set = await pengaturan()
  if (set.jeda) {
    return { tingkat: 'berhenti', kalimat: 'Otomasi sedang dijeda', saran: 'Nyalakan lagi lewat sakelar "Jeda semua otomasi".' }
  }
  const status = await semuaStatusSambungan()
  const gagal = semuaSambungan.filter((s) => status[s.id]?.keadaan === 'gagal')
  if (gagal.length) {
    const st = status[gagal[0].id]
    return {
      tingkat: 'berhenti',
      kalimat: gagal.length === 1 ? `Berhenti: ${gagal[0].nama}` : `Berhenti: ${gagal.map((s) => s.nama).join(', ')} bermasalah`,
      saran: `${st.pesan}. ${st.saran ?? ''}`.trim(),
    }
  }
  const [terakhir, uji] = await Promise.all([ambil<HasilJalan | null>('hasil-terakhir', null), ambil<HasilJalan | null>('hasil-uji', null)])
  const baru = [terakhir, uji].filter((h): h is HasilJalan => !!h).sort((a, b) => b.waktu - a.waktu)[0]
  const gagalJalan = baru?.otomasi.filter((o) => !o.berhasil) ?? []
  if (gagalJalan.length) {
    return {
      tingkat: 'berhenti',
      kalimat: `Berhenti: ${gagalJalan.map((o) => o.nama).join(', ')} gagal`,
      saran: 'Lihat Riwayat. Tekan "Salin laporan untuk agent" lalu tempel ke agent-mu.',
    }
  }
  // Nothing set up yet: say what is missing instead of "Semua aman".
  if (semuaTabel.length === 0) {
    return { tingkat: 'perhatian', kalimat: 'Belum ada tabel data', saran: 'Kirim contoh datamu ke agent, supaya agent menyusun tabelnya.' }
  }
  // Tables that fill up over time (bolehKosong) may be empty on day one.
  for (const t of semuaTabel.filter((x) => !x.bolehKosong)) {
    if ((await semuaBaris(t.id)).length === 0)
      return { tingkat: 'perhatian', kalimat: `Tabel ${t.nama} masih kosong`, saran: 'Isi di halaman Data: impor file CSV atau tambah baris.' }
  }
  const belum = semuaSambungan.filter((s) => status[s.id]?.keadaan !== 'terbukti')
  if (belum.length) {
    return {
      tingkat: 'perhatian',
      kalimat: `${belum[0].nama} belum terbukti tersambung`,
      saran: 'Buka halamannya dan login, lalu tekan "Tes sambungan" di halaman Sambungan.',
    }
  }
  if (semuaOtomasi.length === 0) {
    return { tingkat: 'perhatian', kalimat: 'Belum ada otomasi', saran: 'Minta agent-mu membangun otomasi dari rancanganmu.' }
  }
  const [alarm, draf] = await Promise.all([ambil<Alarm[]>('alarm', []), ambil<PerluDicek[]>('perlu-dicek', [])])
  if (alarm.length) return { tingkat: 'perhatian', kalimat: `Perlu perhatian: ${alarm.length} hal`, saran: alarm[0].pesan }
  if (draf.length) return { tingkat: 'perhatian', kalimat: `${draf.length} draf menunggu kamu cek`, saran: 'Lihat bagian "Perlu dicek" di bawah.' }
  return { tingkat: 'aman', kalimat: 'Semua aman', saran: set.modeUji ? 'Mode uji masih aktif: belum ada yang diubah.' : undefined }
}
