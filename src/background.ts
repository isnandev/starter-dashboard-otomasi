import { ambil, pengaturan, simpan } from './lib/db'
import { jalankan } from './lib/mesin'
import type { Alarm } from './lib/types'

// Background worker: runs the schedule while Chrome is open.
// Everything it does is written to the history, so the dashboard shows it.

const JADWAL = 'otomasi-rutin'
const bukaDashboard = () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })

async function jadwalkan() {
  const set = await pengaturan()
  await chrome.alarms.clear(JADWAL)
  if (set.jeda) {
    await simpan('jalan-berikutnya', null)
    return
  }
  await chrome.alarms.create(JADWAL, { periodInMinutes: set.intervalMenit, delayInMinutes: set.intervalMenit })
  await simpan('jalan-berikutnya', Date.now() + set.intervalMenit * 60_000)
}

// No sample data is ever added: the dashboard starts empty and says so.
chrome.runtime.onInstalled.addListener(async () => {
  await jadwalkan()
  bukaDashboard()
})
chrome.runtime.onStartup.addListener(jadwalkan)
chrome.action.onClicked.addListener(bukaDashboard)
chrome.notifications.onClicked.addListener(bukaDashboard)

// The dashboard asks for a new schedule after settings change.
chrome.runtime.onMessage.addListener((pesan) => {
  if (pesan?.jenis === 'jadwal-ulang') jadwalkan()
})

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== JADWAL) return
  const set = await pengaturan()
  if (set.jeda) return
  await simpan('jalan-berikutnya', Date.now() + set.intervalMenit * 60_000)
  const sebelum = new Set((await ambil<Alarm[]>('alarm', [])).map((x) => x.kunci))
  await jalankan({ uji: set.modeUji, hanya: 'terjadwal' })

  // Notify only about new alarms, so notifications stay meaningful.
  for (const x of await ambil<Alarm[]>('alarm', [])) {
    if (sebelum.has(x.kunci)) continue
    chrome.notifications.create(`alarm-${x.kunci}`, {
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'Perlu perhatian',
      message: `${x.pesan} Buka dashboard untuk melihatnya.`,
    })
  }
  chrome.runtime.sendMessage({ jenis: 'data-berubah' }).catch(() => {})
})
