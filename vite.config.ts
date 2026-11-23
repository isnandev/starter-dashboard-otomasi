import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds a Chrome extension (Manifest V3) into dist/:
// - dashboard.html: the dashboard, opened in a Chrome tab
// - background.js: runs the schedule (chrome.alarms) and the automations
// public/manifest.json is copied as-is.
const dir = import.meta.dirname

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(dir, './src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dashboard: path.resolve(dir, 'dashboard.html'),
        background: path.resolve(dir, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
