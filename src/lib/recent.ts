import type { ModuleId } from '../data/types'

/** 最近访问：只存「怎么回去」所需的最小信息，内容仍由 data 层提供 */
export type RecentEntry = {
  key: string
  kind: 'module' | 'process' | 'step'
  moduleId: ModuleId
  processId?: string
  stepId?: string
  /** 标题在这里定格，避免数据改名后历史记录对不上 */
  title: string
  accent: string
  at: number
}

const KEY = 'sap-map.recent.v1'
const MAX = 8

export function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as RecentEntry[]
    if (!Array.isArray(list)) return []
    return list.filter((e) => e && typeof e.key === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

export function saveRecent(list: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    // 隐私模式下 localStorage 会抛错：历史记录不是关键路径，静默降级
  }
}

export function pushRecent(list: RecentEntry[], entry: Omit<RecentEntry, 'at'>): RecentEntry[] {
  const next = [{ ...entry, at: Date.now() }, ...list.filter((e) => e.key !== entry.key)]
  const trimmed = next.slice(0, MAX)
  saveRecent(trimmed)
  return trimmed
}
