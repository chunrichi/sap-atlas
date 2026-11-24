import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import MapCanvas from './canvas/MapCanvas'
import Hud from './panels/Hud'
import StepHoverCard from './panels/StepHoverCard'
import ObjectDrawer from './panels/ObjectDrawer'
import CommandPalette from './panels/CommandPalette'
import GhostCompass from './panels/GhostCompass'
import FlowRail from './panels/FlowRail'
import BackToContent from './panels/BackToContent'
import RecentRail from './panels/RecentRail'
import { useHashRoute } from './app/hooks/useHashRoute'
import { useNavigate } from './canvas/hooks/useNavigate'
import { validateContent } from './data'
import { useViewStore } from './state/viewStore'
import { filterActive } from './lib/filter'

if (import.meta.env.DEV) {
  const problems = validateContent()
  if (problems.length) console.warn('[sap-map] 内容校验发现问题：\n' + problems.join('\n'))
}

/** 必须在 ReactFlowProvider 之内：导航要用 useReactFlow */
function Shell() {
  useHashRoute()
  const nav = useNavigate()
  const setCoarse = useViewStore((s) => s.setCoarse)

  // 触屏：点按先预览、再点才下钻。用媒体查询而不是 UA 嗅探（可翻转的二合一设备）
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setCoarse(mq.matches)
    const on = (e: MediaQueryListEvent) => setCoarse(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [setCoarse])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      const st = useViewStore.getState()

      if (e.key === 'Escape') {
        if (st.searchOpen) return // 命令面板自己处理 Esc
        if (st.objectId) {
          st.closeObject()
          return
        }
        if (st.impactObjectId) {
          st.setImpactObject(null)
          return
        }
        // 逐级退出：步骤 → 流程 → 模块 → 全局。用 replace，避免"退一级却多一条历史"
        if (st.selectedStepId && st.focusedProcessId) {
          nav.goProcess(st.focusedProcessId, { history: false })
        } else if (st.focusedProcessId && st.focusedModuleId) {
          nav.goModule(st.focusedModuleId, { history: false })
        } else if (st.focusedModuleId) {
          nav.goHome({ history: false })
        }
        return
      }

      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      // I：把当前打开的对象切换成影响面
      if (e.key.toLowerCase() === 'i' && st.objectId) {
        e.preventDefault()
        st.setImpactObject(st.impactObjectId === st.objectId ? null : st.objectId)
        st.closeObject()
        return
      }

      // Shift+1 全局 / Shift+2 回到当前层级（无限画布的通用约定）
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault()
        nav.goHome()
        return
      }
      if (e.shiftKey && e.code === 'Digit2') {
        e.preventDefault()
        if (st.selectedStepId && st.focusedProcessId) nav.goStep(st.focusedProcessId, st.selectedStepId)
        else if (st.focusedProcessId) nav.goProcess(st.focusedProcessId)
        else if (st.focusedModuleId) nav.goModule(st.focusedModuleId)
        else nav.goHome()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav])

  return (
    <>
      <MapCanvas />
      <Hud />
      <GhostCompass />
      <RecentRail />
      <BackToContent />
      <FlowRail />
      <StepHoverCard />
      <ObjectDrawer />
      <CommandPalette />
    </>
  )
}

export default function App() {
  const lod = useViewStore((s) => s.lod)
  const flowOpen = useViewStore((s) => s.flowOpen)
  const impact = useViewStore((s) => s.impactObjectId)
  const offGrid = useViewStore((s) => s.offGrid)
  const filtering = useViewStore((s) => s.filter)
  const filterOn = filterActive(filtering)

  return (
    <div
      className="app"
      data-lod={lod}
      data-flow={flowOpen ? '1' : '0'}
      data-impact={impact ? '1' : '0'}
      data-offgrid={offGrid ? '1' : '0'}
      data-filter={filterOn ? '1' : '0'}
    >
      <ReactFlowProvider>
        <Shell />
      </ReactFlowProvider>
    </div>
  )
}
