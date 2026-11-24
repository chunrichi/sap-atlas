import { create } from 'zustand'
import type { ModuleId } from '../data/types'

export type HoverInfo = {
  stepId: string
  processId: string
  x: number
  y: number
}

type ViewState = {
  /** 0 星系 / 1 模块 / 2 流程 / 3 步骤 */
  lod: number
  size: { w: number; h: number }
  focusedModuleId: ModuleId | null
  focusedProcessId: string | null
  selectedStepId: string | null
  hover: HoverInfo | null
  objectId: string | null

  setLod: (n: number) => void
  setSize: (w: number, h: number) => void
  focusModule: (id: ModuleId | null) => void
  focusProcess: (id: string | null) => void
  selectStep: (id: string | null) => void
  hoverStep: (info: HoverInfo) => void
  keepHover: () => void
  scheduleHide: () => void
  hideNow: () => void
  openObject: (id: string) => void
  closeObject: () => void
  reset: () => void
}

let hideTimer: ReturnType<typeof setTimeout> | undefined

export const useViewStore = create<ViewState>((set, get) => ({
  lod: 0,
  size: { w: 1200, h: 800 },
  focusedModuleId: null,
  focusedProcessId: null,
  selectedStepId: null,
  hover: null,
  objectId: null,

  setLod: (n) => {
    if (get().lod === n) return
    set({ lod: n })
    // 缩回全局视图时，自动解除聚焦，避免整屏都是半透明的模块
    if (n === 0 && get().focusedModuleId) {
      set({ focusedModuleId: null, focusedProcessId: null, selectedStepId: null })
    }
  },
  setSize: (w, h) => {
    const { size } = get()
    if (size.w === w && size.h === h) return
    set({ size: { w, h } })
  },
  focusModule: (id) =>
    set({ focusedModuleId: id, focusedProcessId: null, selectedStepId: null, hover: null }),
  focusProcess: (id) => set({ focusedProcessId: id, selectedStepId: null, hover: null }),
  selectStep: (id) => set({ selectedStepId: id }),
  hoverStep: (info) => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ hover: info })
  },
  keepHover: () => {
    if (hideTimer) clearTimeout(hideTimer)
  },
  scheduleHide: () => {
    if (hideTimer) clearTimeout(hideTimer)
    hideTimer = setTimeout(() => set({ hover: null }), 240)
  },
  hideNow: () => {
    if (hideTimer) clearTimeout(hideTimer)
    set({ hover: null })
  },
  openObject: (id) => set({ objectId: id }),
  closeObject: () => set({ objectId: null }),
  reset: () =>
    set({
      focusedModuleId: null,
      focusedProcessId: null,
      selectedStepId: null,
      hover: null,
      objectId: null,
    }),
}))
