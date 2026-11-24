import { useViewport } from '@xyflow/react'
import { laneIndexOf, laneRect, moduleRect } from '../canvas/layout/layout'
import { moduleById, processById } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'

/**
 * 「回到内容」：画布可以被平移到一片空白，
 * 这时必须有一个明确的出口，否则用户只能靠缩小/刷新自救。
 * 它同时给出方向——「内容在你右上方」比单纯一个按钮有用得多。
 */
export default function BackToContent() {
  const offGrid = useViewStore((s) => s.offGrid)
  const size = useViewStore((s) => s.size)
  const moduleId = useViewStore((s) => s.focusedModuleId)
  const processId = useViewStore((s) => s.focusedProcessId)
  const stepId = useViewStore((s) => s.selectedStepId)
  const vp = useViewport()
  const { goHome, goModule, goProcess, goStep } = useNavigate()

  if (!offGrid) return null

  const m = moduleId ? moduleById[moduleId] : null
  const p = processId ? processById[processId] : null

  // 方向标取「当前焦点」的中心；没有焦点就指向全局中心，让用户知道大部队在哪
  let cx = 0
  let cy = 0
  if (m) {
    const r = p ? laneRect(m, laneIndexOf(m.id, p.id)) : moduleRect(m)
    cx = r.x + r.w / 2
    cy = r.y + r.h / 2
  }
  const sx = cx * vp.zoom + vp.x
  const sy = cy * vp.zoom + vp.y
  const dx = sx - size.w / 2
  const dy = sy - size.h / 2
  const dir =
    Math.abs(dx) > Math.abs(dy) * 1.2
      ? dx < 0
        ? 'left'
        : 'right'
      : dy < 0
        ? 'up'
        : 'down'

  const label = p ? p.name : m ? `${m.code} ${m.name}` : '全局视图'
  const hint = p ? `${m?.code ?? ''} · 当前流程` : m ? '当前模块' : '六个模块的总览'

  const back = () => {
    if (stepId && processId) goStep(processId, stepId)
    else if (processId) goProcess(processId)
    else if (moduleId) goModule(moduleId)
    else goHome()
  }

  return (
    <button
      type="button"
      className="back-content"
      data-dir={dir}
      style={{ ['--accent' as string]: m?.accent ?? '#2f5fd0' }}
      onClick={back}
      title="视口里已经没有内容了（Shift+1 回全局）"
    >
      <span className="bc-arrow" aria-hidden>
        {dir === 'left' ? '←' : dir === 'right' ? '→' : dir === 'up' ? '↑' : '↓'}
      </span>
      <span className="bc-text">
        <b>回到 {label}</b>
        <em>{hint}</em>
      </span>
    </button>
  )
}
