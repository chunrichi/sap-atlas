import type { ModuleId, Process, SapModule } from '../../data/types'
import { processesByModule } from '../../data'

/** 世界坐标系常量。所有位置都从这里推导，保证缩放时不会漂移。 */
export const MODULE_W = 2300
export const MODULE_H = 1860
export const GRID_X = 2600
export const GRID_Y = 2060

export const LANE_X = 80
export const LANE_Y0 = 190
export const LANE_W = 2140
export const LANE_H = 520
export const LANE_GAP = 550

export const STEP_W = 224
export const STEP_H = 116
export const STEP_PAD_X = 60
export const STEP_DX = 258
export const STEP_DY = 132
export const STEP_Y_TOP = 110

export type Rect = { x: number; y: number; w: number; h: number }

export function moduleRect(m: SapModule): Rect {
  return { x: m.col * GRID_X, y: m.row * GRID_Y, w: MODULE_W, h: MODULE_H }
}

export function laneIndexOf(moduleId: ModuleId, processId: string): number {
  const list = processesByModule[moduleId] ?? []
  const i = list.findIndex((p) => p.id === processId)
  return i < 0 ? 0 : i
}

export function laneRect(m: SapModule, index: number): Rect {
  const base = moduleRect(m)
  return {
    x: base.x + LANE_X,
    y: base.y + LANE_Y0 + index * LANE_GAP,
    w: LANE_W,
    h: LANE_H,
  }
}

/** 单行流程垂直居中，多行流程从顶部排 */
export function stepYBase(maxRow: number): number {
  return maxRow === 0 ? (LANE_H - STEP_H) / 2 : STEP_Y_TOP
}

export function stepRect(lane: Rect, col: number, row: number, yBase: number): Rect {
  return {
    x: lane.x + STEP_PAD_X + col * STEP_DX,
    y: lane.y + yBase + row * STEP_DY,
    w: STEP_W,
    h: STEP_H,
  }
}

export function maxRowOf(p: Process): number {
  return p.lanes.reduce((m, l) => Math.max(m, l.row), 0)
}

/** 全局世界边界（用于 fitView 与 minimap） */
export function worldBounds(): Rect {
  return { x: 0, y: 0, w: 2 * GRID_X + MODULE_W, h: GRID_Y + MODULE_H }
}

/** 用固定留白计算「全局视图」的视口，比 fitView 的 padding 更可控 */
export function homeViewport(vw: number, vh: number) {
  const b = worldBounds()
  const margin = 96
  const zoom = Math.min((vw - margin * 2) / b.w, (vh - margin * 2) / b.h)
  return {
    zoom,
    x: vw / 2 - (b.x + b.w / 2) * zoom,
    y: vh / 2 - (b.y + b.h / 2) * zoom,
  }
}
