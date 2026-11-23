import type { Tabel } from '@/lib/types'

// The business's own tables: the main storage, on this computer.
// Empty on purpose. The agent adds them from the rancangan's "Data yang
// dipakai", but ONLY after it has seen the owner's own sample data (a sheet,
// a CSV, a photo of a notebook, a screenshot) or the owner approved a
// recommended set of columns. `asal` records which one. See AGENTS.md,
// "Before making a table".
export const tabel: Tabel[] = []
