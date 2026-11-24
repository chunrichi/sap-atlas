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
  searchOpen: boolean
  /** 端到端主线是否展开 */
  flowOpen: boolean
  flowId: string
  /** 导航动画结束的时间戳：动画途中会短暂经过 L0，不能据此清焦点 */
  navUntil: number

  setLod: (n: number) => void
  clearFocus: () => void
  setSize: (w: number, h: number) => void
  focusModule: (id: ModuleId | null) => void
  focusProcess: (id: string | null) => void
  selectStep: (id: string | null) => void
  hoverStep: (info: HoverInfo) => void
  keepHover: () => void
  scheduleHide: () => void
  hideNow: () => void
  openObject: (id: string) => void
  setSearchOpen: (v: boolean) => void
  setFlowOpen: (v: boolean) => void
  setFlowId: (id: string) => void
  markNav: (ms: number) => void
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
  searchOpen: false,
  flowOpen: false,
  flowId: 'flow.p2c',
  navUntil: 0,

  setLod: (n) => {
    if (get().lod === n) return
    set({ lod: n })
  },
  // 由画布在「稳定处于 L0」时调用：导航动画途中会短暂经过 L0，不能立刻清，
  // 否则深链刚聚焦就被抹掉。
  clearFocus: () =>
    set({ focusedModuleId: null, focusedProcessId: null, selectedStepId: null }),
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
  setSearchOpen: (v) => set({ searchOpen: v }),
  setFlowOpen: (v) => set({ flowOpen: v }),
  setFlowId: (id) => set({ flowId: id }),
  markNav: (ms) => set({ navUntil: Date.now() + ms }),
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
