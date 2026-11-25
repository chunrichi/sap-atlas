import { create } from 'zustand'
import type { ModuleId } from '../data/types'
import { EMPTY_FILTER, type FilterState } from '../lib/filter'
import { loadRecent, pushRecent, type RecentEntry } from '../lib/recent'
import type { PathNode, PathRef } from '../lib/path'
import { resolveRef } from '../lib/path'

export type HoverInfo = {
  stepId: string
  processId: string
  /** 源卡片右边缘（屏幕坐标） */
  x: number
  /** 源卡片上边缘 */
  y: number
  /** 源卡片宽高：用来判断左右哪边放得下浮层 */
  w: number
  h: number
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
  /** 影响面模式：高亮所有引用该对象的步骤 */
  impactObjectId: string | null
  searchOpen: boolean
  /** 端到端主线是否展开 */
  flowOpen: boolean
  flowId: string
  /** 导航动画结束的时间戳：动画途中会短暂经过 L0，不能据此清焦点 */
  navUntil: number
  /** 视口是否已经离开全部内容：为真时出现「回到内容」 */
  offGrid: boolean
  /** 触屏（pointer: coarse）：点按先预览、再点才下钻 */
  coarse: boolean
  filter: FilterState
  /** 最近访问，最多 8 条，落 localStorage */
  recent: RecentEntry[]
  /** 左侧清单视图（步骤表 / 对象表） */
  listOpen: boolean
  /** 两点路径：面板、两端、结果 */
  pathOpen: boolean
  pathFrom: PathRef | null
  pathTo: PathRef | null
  path: PathNode[] | null
  pathMiss: boolean

  setLod: (n: number) => void
  setOffGrid: (v: boolean) => void
  setCoarse: (v: boolean) => void
  setListOpen: (v: boolean) => void
  setPathOpen: (v: boolean) => void
  setPathEnd: (which: 'from' | 'to', ref: PathRef | null) => void
  setPath: (list: PathNode[] | null, miss?: boolean) => void
  closePath: () => void
  setFilter: (patch: Partial<FilterState>) => void
  clearFilter: () => void
  addRecent: (entry: Omit<RecentEntry, 'at'>) => void
  clearRecent: () => void
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
  setImpactObject: (id: string | null) => void
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
  impactObjectId: null,
  searchOpen: false,
  flowOpen: false,
  flowId: 'flow.p2c',
  navUntil: 0,
  offGrid: false,
  coarse: false,
  filter: EMPTY_FILTER,
  recent: loadRecent(),
  listOpen: false,
  pathOpen: false,
  pathFrom: null,
  pathTo: null,
  path: null,
  pathMiss: false,

  setLod: (n) => {
    if (get().lod === n) return
    set({ lod: n })
  },
  setOffGrid: (v) => {
    if (get().offGrid === v) return
    set({ offGrid: v })
  },
  setCoarse: (v) => {
    if (get().coarse === v) return
    set({ coarse: v })
  },
  setListOpen: (v) => {
    if (get().listOpen === v) return
    set({ listOpen: v, hover: null })
  },
  setPathOpen: (v) => {
    if (get().pathOpen === v) return
    // 打开时把当前选中的步骤当起点：省掉「先点哪儿」的犹豫
    const st = get()
    const next: Partial<ViewState> = { pathOpen: v, hover: null }
    if (v && !st.pathFrom && st.selectedStepId) {
      next.pathFrom = resolveRef(st.selectedStepId, st.focusedProcessId)
    }
    if (!v) {
      next.path = null
      next.pathTo = null
      next.pathMiss = false
    }
    set(next)
  },
  setPathEnd: (which, ref) =>
    set(
      which === 'from'
        ? { pathFrom: ref, path: null, pathMiss: false }
        : { pathTo: ref, path: null, pathMiss: false },
    ),
  setPath: (list, miss = false) => set({ path: list, pathMiss: miss }),
  closePath: () =>
    set({ pathOpen: false, pathFrom: null, pathTo: null, path: null, pathMiss: false }),
  setFilter: (patch) => set({ filter: { ...get().filter, ...patch } }),
  clearFilter: () => set({ filter: EMPTY_FILTER }),
  addRecent: (entry) => set({ recent: pushRecent(get().recent, entry) }),
  clearRecent: () => {
    set({ recent: [] })
    try {
      localStorage.removeItem('sap-map.recent.v1')
    } catch {
      // 忽略：隐私模式下不可写
    }
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
  // 进入影响面时清掉悬停：否则残留的浮层会挡住高亮出来的步骤
  setImpactObject: (id) => set({ impactObjectId: id, hover: id ? null : get().hover }),
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
      impactObjectId: null,
    }),
}))
