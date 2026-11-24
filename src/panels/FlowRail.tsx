import { useEffect, useRef } from 'react'
import { beatsOf, endToEndFlows, moduleById, processById, stepById } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

/**
 * 端到端主线：底部横向时间轴。
 * 它回答的是「这一步在整个价值链里排第几、前后是谁」——
 * 单看一个模块的泳道是回答不了的。
 */
export default function FlowRail() {
  const open = useViewStore((s) => s.flowOpen)
  const setOpen = useViewStore((s) => s.setFlowOpen)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const { goStep } = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)

  const flowId = useViewStore((s) => s.flowId)
  const setFlowId = useViewStore((s) => s.setFlowId)
  const flow = endToEndFlows.find((f) => f.id === flowId) ?? endToEndFlows[0]
  const beats = beatsOf(flow)
  const activeIdx = selectedStepId ? beats.findIndex((b) => b.stepId === selectedStepId) : -1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(!useViewStore.getState().flowOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  // 主线比屏幕宽：走到后面的步骤时，把当前 chip 滚到视野中间
  useEffect(() => {
    if (!open || activeIdx < 0) return
    const el = trackRef.current?.querySelector('.fr-beat.is-on')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [open, activeIdx])

  if (!open) return null

  const jump = (i: number) => {
    const b = beats[Math.max(0, Math.min(beats.length - 1, i))]
    if (b) goStep(b.processId, b.stepId)
  }

  let cursor = 0

  return (
    <aside className="flow-rail" aria-label="端到端主线">
      <div className="fr-head">
        <div className="fr-title-wrap">
          <div className="fr-tabs">
            {endToEndFlows.map((f) => (
              <button
                type="button"
                key={f.id}
                className={cx('fr-tab', f.id === flow.id && 'is-on')}
                onClick={() => setFlowId(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>
          <span className="fr-sub">
            {flow.modules} · {beats.length} 步
            {activeIdx >= 0 && <b>第 {activeIdx + 1} 步</b>}
          </span>
        </div>

        <div className="fr-note">{activeIdx >= 0 ? beats[activeIdx].note : flow.goal}</div>

        <div className="fr-nav">
          <button type="button" onClick={() => jump(activeIdx <= 0 ? 0 : activeIdx - 1)}>
            上一步
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => jump(activeIdx < 0 ? 0 : activeIdx + 1)}
          >
            {activeIdx < 0 ? '从第一步开始' : activeIdx >= beats.length - 1 ? '回到第一步' : '下一步'}
          </button>
          <button type="button" className="fr-close" onClick={() => setOpen(false)} title="收起（F）">
            ×
          </button>
        </div>
      </div>

      <div className="fr-track" ref={trackRef}>
        {flow.phases.map((ph) => (
          <div className="fr-phase" key={ph.id}>
            <span className="fr-phase-name">{ph.name}</span>
            <div className="fr-beats">
              {ph.beats.map((b) => {
                const i = cursor++
                const p = processById[b.processId]
                const m = p ? moduleById[p.moduleId] : null
                const s = stepById[b.stepId]
                if (!p || !m || !s) return null
                return (
                  <button
                    type="button"
                    key={`${b.processId}-${b.stepId}`}
                    className={cx('fr-beat', i === activeIdx && 'is-on')}
                    style={{ ['--accent' as string]: m.accent }}
                    onClick={() => goStep(b.processId, b.stepId)}
                    title={b.note}
                  >
                    <em>{i + 1}</em>
                    <b>{m.code}</b>
                    <span>{s.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
