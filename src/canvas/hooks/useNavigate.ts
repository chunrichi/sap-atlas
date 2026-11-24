import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { moduleById, processById, stepById } from '../../data'
import type { ModuleId } from '../../data/types'
import {
  homeViewport,
  laneIndexOf,
  laneRect,
  moduleRect,
  maxRowOf,
  stepRect,
  stepYBase,
} from '../layout/layout'
import type { Rect } from '../layout/layout'
import { useViewStore } from '../../state/viewStore'

export const ZOOM = {
  module: 0.42,
  process: 0.9,
  step: 1.28,
} as const

/** 不依赖 store 里的尺寸，直接量容器 —— 节点被 memo 后订阅值会过期 */
let navToken = 0

function measure() {
  const el = document.querySelector('.react-flow') as HTMLElement | null
  const r = el?.getBoundingClientRect()
  return { w: r?.width || 1280, h: r?.height || 800 }
}

function viewportFor(rect: Rect, zoom: number, vw: number, vh: number) {
  return {
    x: vw / 2 - (rect.x + rect.w / 2) * zoom,
    y: vh / 2 - (rect.y + rect.h / 2) * zoom,
    zoom,
  }
}

function pointFor(x: number, y: number, zoom: number, vw: number, vh: number) {
  return { x: vw / 2 - x * zoom, y: vh / 2 - y * zoom, zoom }
}

export function useNavigate() {
  const rf = useReactFlow()
  const focusModule = useViewStore((s) => s.focusModule)
  const focusProcess = useViewStore((s) => s.focusProcess)
  const selectStep = useViewStore((s) => s.selectStep)
  const reset = useViewStore((s) => s.reset)

  const fly = useCallback(
    (vp: { x: number; y: number; zoom: number }, duration = 700) => {
      const token = ++navToken
      void rf.setViewport(vp, { duration })
      // 兜底：动画被中断（标签页切到后台等）时也要落到目标位置
      window.setTimeout(() => {
        if (navToken === token) void rf.setViewport(vp)
      }, duration + 160)
    },
    [rf],
  )

  const goHome = useCallback(() => {
    reset()
    const { w, h } = measure()
    fly(homeViewport(w, h), 800)
  }, [fly, reset])

  const goModule = useCallback(
    (id: ModuleId) => {
      focusModule(id)
      const m = moduleById[id]
      if (!m) return
      const { w, h } = measure()
      fly(viewportFor(moduleRect(m), ZOOM.module, w, h))
    },
    [fly, focusModule],
  )

  const goProcess = useCallback(
    (id: string) => {
      const p = processById[id]
      if (!p) return
      focusProcess(id)
      const m = moduleById[p.moduleId]
      const lane = laneRect(m, laneIndexOf(p.moduleId, id))
      const { w, h } = measure()
      // 对齐到泳道前段：点流程时想看的是「从头开始」
      const anchorX = lane.x + Math.min(lane.w / 2, 720)
      const anchorY = lane.y + lane.h / 2
      fly(pointFor(anchorX, anchorY, ZOOM.process, w, h))
    },
    [fly, focusProcess],
  )

  const goStep = useCallback(
    (processId: string, stepId: string) => {
      const p = processById[processId]
      const step = stepById[stepId]
      if (!p || !step) return
      const m = moduleById[p.moduleId]
      const lane = laneRect(m, laneIndexOf(p.moduleId, processId))
      const placement = p.lanes.find((l) => l.stepId === stepId)
      if (!placement) return
      selectStep(stepId)
      const { w, h } = measure()
      const r = stepRect(lane, placement.col, placement.row, stepYBase(maxRowOf(p)))
      fly(viewportFor(r, ZOOM.step, w, h), 620)
    },
    [fly, selectStep],
  )

  return { goHome, goModule, goProcess, goStep }
}
