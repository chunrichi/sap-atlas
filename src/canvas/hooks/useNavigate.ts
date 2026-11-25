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
  STEP_DX,
  STEP_H,
  STEP_PAD_X,
  STEP_W,
  STEP_DY,
} from '../layout/layout'
import type { Rect } from '../layout/layout'
import { useViewStore } from '../../state/viewStore'
import { writeHash } from '../../lib/route'

export const ZOOM = {
  module: 0.42,
  /** 流程视图的上下限：下限要高于 L2 阈值，否则会掉回 L1 看不到标题 */
  process: { min: 0.64, max: 0.94 },
  step: 1.28,
} as const

/** 从 hash / popstate 恢复视图时不能写历史，否则后退会原地打转 */
export type NavOpts = { history?: boolean }

let navToken = 0

/** 清单面板的宽度：它就是画布被占掉的左边距 */
export const LIST_W = 408

/**
 * 取景必须知道「可视区被谁占着」：
 * 清单打开时画布右侧才是自由区，居中要按剩余区域算，否则内容会藏到面板后面。
 */
export function canvasInset() {
  const st = useViewStore.getState()
  if (!st.listOpen) return 0
  if (window.innerWidth <= 760) return 0
  return LIST_W
}

function measure() {
  const el = document.querySelector('.react-flow') as HTMLElement | null
  const r = el?.getBoundingClientRect()
  const off = canvasInset()
  return { w: (r?.width || 1280) - off, h: r?.height || 800, off }
}

function viewportFor(rect: Rect, zoom: number, vw: number, vh: number, off = 0) {
  return {
    x: off + vw / 2 - (rect.x + rect.w / 2) * zoom,
    y: vh / 2 - (rect.y + rect.h / 2) * zoom,
    zoom,
  }
}

const historyMode = (opts?: NavOpts) => (opts?.history === false ? 'replace' : 'push')

export function useNavigate() {
  const rf = useReactFlow()
  const focusModule = useViewStore((s) => s.focusModule)
  const focusProcess = useViewStore((s) => s.focusProcess)
  const selectStep = useViewStore((s) => s.selectStep)
  const reset = useViewStore((s) => s.reset)
  const markNav = useViewStore((s) => s.markNav)
  const addRecent = useViewStore((s) => s.addRecent)

  const fly = useCallback(
    (vp: { x: number; y: number; zoom: number }, duration = 700) => {
      const token = ++navToken
      markNav(duration + 400)
      void rf.setViewport(vp, { duration })
      // 兜底：动画被中断（标签页切到后台等）时也要落到目标位置
      window.setTimeout(() => {
        if (navToken === token) void rf.setViewport(vp)
      }, duration + 160)
    },
    [markNav, rf],
  )

  const goHome = useCallback(
    (opts?: NavOpts) => {
      writeHash({ kind: 'home' }, historyMode(opts))
      reset()
      const { w, h, off } = measure()
      const home = homeViewport(w, h)
      fly({ ...home, x: home.x + off }, 800)
    },
    [fly, reset],
  )

  const goModule = useCallback(
    (id: ModuleId, opts?: NavOpts) => {
      writeHash({ kind: 'module', moduleId: id }, historyMode(opts))
      focusModule(id)
      const m = moduleById[id]
      if (!m) return
      addRecent({
        key: `m:${id}`,
        kind: 'module',
        moduleId: id,
        title: `${m.code} ${m.name}`,
        accent: m.accent,
      })
      const { w, h, off } = measure()
      fly(viewportFor(moduleRect(m), ZOOM.module, w, h, off))
    },
    [addRecent, fly, focusModule],
  )

  const goProcess = useCallback(
    (id: string, opts?: NavOpts) => {
      const p = processById[id]
      if (!p) return
      writeHash({ kind: 'process', processId: id }, historyMode(opts))
      focusModule(p.moduleId)
      focusProcess(id)
      const m = moduleById[p.moduleId]
      addRecent({
        key: `p:${id}`,
        kind: 'process',
        moduleId: p.moduleId,
        processId: id,
        title: p.name,
        accent: m?.accent ?? '#64748b',
      })
      const lane = laneRect(m, laneIndexOf(p.moduleId, id))
      const { w, h, off } = measure()
      // 让整条流程一次看全：按内容宽高算缩放，而不是固定倍率
      const maxCol = p.lanes.reduce((n, l) => Math.max(n, l.col), 0)
      const maxRow = Math.max(maxRowOf(p), 0)
      const contentW = STEP_PAD_X * 2 + maxCol * STEP_DX + STEP_W
      // 用「卡片带」而不是整个泳道来取景：单行泳道的卡片是垂直居中的，
      // 按泳道高度算会把内容压到下半屏。
      const yBase = stepYBase(maxRow)
      const bandTop = lane.y + yBase - 24
      const contentH = maxRow * STEP_DY + STEP_H + 48
      const zoom = Math.max(
        ZOOM.process.min,
        Math.min(ZOOM.process.max, Math.min((w - 96) / contentW, (h - 130) / contentH)),
      )
      // 缩放有下限（再小就跌回 L1），窄视口下内容必然溢出。
      // 这时改成「左对齐 + 上留白」，保证泳道标题和流程起点可见，剩下的靠平移。
      const fitsW = contentW * zoom <= w - 48
      const fitsH = contentH * zoom <= h - 136
      const vp = {
        x: off + (fitsW ? w / 2 - (lane.x + contentW / 2) * zoom : 24 - lane.x * zoom),
        y: fitsH ? h / 2 - (bandTop + contentH / 2) * zoom : 104 - bandTop * zoom,
        zoom,
      }
      fly(vp, 760)
    },
    [addRecent, fly, focusModule, focusProcess],
  )

  const goStep = useCallback(
    (processId: string, stepId: string, opts?: NavOpts) => {
      const p = processById[processId]
      const step = stepById[stepId]
      if (!p || !step) return
      const m = moduleById[p.moduleId]
      const lane = laneRect(m, laneIndexOf(p.moduleId, processId))
      const placement = p.lanes.find((l) => l.stepId === stepId)
      if (!placement) return
      writeHash({ kind: 'step', processId, stepId }, historyMode(opts))
      focusModule(p.moduleId)
      focusProcess(processId)
      selectStep(stepId)
      addRecent({
        key: `s:${processId}::${stepId}`,
        kind: 'step',
        moduleId: p.moduleId,
        processId,
        stepId,
        title: step.name,
        accent: m?.accent ?? '#64748b',
      })
      const { w, h, off } = measure()
      const r = stepRect(lane, placement.col, placement.row, stepYBase(maxRowOf(p)))
      fly(viewportFor(r, ZOOM.step, w, h, off), 620)
    },
    [addRecent, fly, focusModule, focusProcess, selectStep],
  )

  return { goHome, goModule, goProcess, goStep }
}
