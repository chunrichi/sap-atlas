import { useState } from 'react'
import { useViewStore } from '../state/viewStore'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { cx } from '../lib/cx'

const KIND_LABEL: Record<string, string> = { module: '模块', process: '流程', step: '步骤' }

/**
 * 最近访问。它替代的是「浏览器后退」这种和知识库语义无关的操作：
 * 在网状图里"刚才那个流程"比"上一页"更接近人的记忆单位。
 */
export default function RecentRail() {
  const recent = useViewStore((s) => s.recent)
  const clearRecent = useViewStore((s) => s.clearRecent)
  const [open, setOpen] = useState(true)
  const { goModule, goProcess, goStep } = useNavigate()

  if (recent.length === 0) return null

  const go = (key: string) => {
    const e = recent.find((x) => x.key === key)
    if (!e) return
    if (e.kind === 'step' && e.processId && e.stepId) goStep(e.processId, e.stepId)
    else if (e.kind === 'process' && e.processId) goProcess(e.processId)
    else goModule(e.moduleId)
  }

  return (
    <aside className={cx('recent-rail', !open && 'is-collapsed')} aria-label="最近访问">
      <button
        type="button"
        className="recent-head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>最近访问</span>
        <em>{recent.length}</em>
        <i aria-hidden>{open ? '⌃' : '⌄'}</i>
      </button>

      {open && (
        <div className="recent-list">
          {recent.map((e) => (
            <button
              type="button"
              key={e.key}
              className="recent-item"
              style={{ ['--accent' as string]: e.accent }}
              onClick={() => go(e.key)}
              title={`${KIND_LABEL[e.kind]} · ${e.title}`}
            >
              <i />
              <span>{e.title}</span>
              <em>{KIND_LABEL[e.kind]}</em>
            </button>
          ))}
          <button type="button" className="recent-clear" onClick={clearRecent}>
            清除记录
          </button>
        </div>
      )}
    </aside>
  )
}
