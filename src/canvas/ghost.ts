import { moduleById, processesOfStep } from '../data'
import type { ModuleId } from '../data/types'
import { laneIndexOf, laneRect, maxRowOf, stepRect, stepYBase } from './layout/layout'
import type { Rect } from './layout/layout'

export type Instance = {
  processId: string
  moduleId: ModuleId
  rect: Rect
  order: number
}

/** 同一步骤在世界坐标里的所有落位（跨流程、跨模块） */
export function instancesOf(stepId: string): Instance[] {
  const out: Instance[] = []
  for (const p of processesOfStep[stepId] ?? []) {
    const m = moduleById[p.moduleId]
    if (!m) continue
    const lane = laneRect(m, laneIndexOf(p.moduleId, p.id))
    const yBase = stepYBase(maxRowOf(p))
    const sorted = [...p.lanes].sort((a, b) => a.col - b.col || a.row - b.row)
    sorted.forEach((pl, i) => {
      if (pl.stepId !== stepId) return
      out.push({
        processId: p.id,
        moduleId: p.moduleId,
        rect: stepRect(lane, pl.col, pl.row, yBase),
        order: i + 1,
      })
    })
  }
  return out
}

/** 世界坐标 → 屏幕坐标 */
export function toScreen(r: Rect, vp: { x: number; y: number; zoom: number }) {
  return {
    x: (r.x + r.w / 2) * vp.zoom + vp.x,
    y: (r.y + r.h / 2) * vp.zoom + vp.y,
  }
}
