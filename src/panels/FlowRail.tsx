import { useEffect, useMemo, useRef, useState } from 'react'
import { beatsOf, endToEndFlows, moduleById, processById, stepById } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

const PLAY_MS = 2400

/**
 * 端到端主线：底部横向时间轴。
 * 它回答的是「这一步在整个价值链里排第几、前后是谁」——
 * 单看一个模块的泳道是回答不了的。
 *
 * 退货不是第二条主线，是开票之后的分叉：所以它渲染在主线的下方，
 * 而不是变成另一个需要用户自己去发现的 tab。
 */
export default function FlowRail() {
  const open = useViewStore((s) => s.flowOpen)
  const setOpen = useViewStore((s) => s.setFlowOpen)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const { goStep } = useNavigate()
  const trackRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)

  const flowId = useViewStore((s) => s.flowId)
  const setFlowId = useViewStore((s) => s.setFlowId)

  const tops = endToEndFlows.filter((f) => !f.branch)
  const flow = tops.find((f) => f.id === flowId) ?? tops[0]
  const branches = endToEndFlows.filter((f) => f.branch?.flowId === flow.id)
  // 必须 memo：beatsOf 每次返回新数组，会让播放定时器在无关重渲染时被反复重置
  const beats = useMemo(() => beatsOf(flow), [flow])
  const activeIdx = selectedStepId ? beats.findIndex((b) => b.stepId === selectedStepId) : -1

  const jump = (i: number) => {
    const b = beats[Math.max(0, Math.min(beats.length - 1, i))]
    if (b) goStep(b.processId, b.stepId)
  }

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

  // 播放：每 2.4s 走一步，走到头自动停。讲流程时不用一直点
  useEffect(() => {
    if (!open) {
      setPlaying(false)
      return
    }
    if (!playing) return
    if (activeIdx >= beats.length - 1) {
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => {
      const next = beats[activeIdx + 1]
      if (next) goStep(next.processId, next.stepId)
    }, PLAY_MS)
    return () => window.clearTimeout(t)
  }, [open, playing, activeIdx, beats, goStep])

  // 主线比屏幕宽：走到后面的步骤时，把当前 chip 滚到视野中间
  useEffect(() => {
    if (!open || activeIdx < 0) return
    const el = trackRef.current?.querySelector('.fr-beat.is-on')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [open, activeIdx])

  if (!open) return null

  const togglePlay = () => {
    if (!playing && activeIdx < 0) jump(0)
    setPlaying(!playing)
  }

  let cursor = 0

  return (
    <aside className="flow-rail" aria-label="端到端主线">
      <div className="fr-head">
        <div className="fr-title-wrap">
          {tops.length > 1 && (
            <div className="fr-tabs">
              {tops.map((f) => (
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
          )}
          <span className="fr-sub">
            {flow.modules} · {beats.length} 步
            {activeIdx >= 0 && <b>第 {activeIdx + 1} 步</b>}
          </span>
        </div>

        <div className="fr-note">{activeIdx >= 0 ? beats[activeIdx].note : flow.goal}</div>

        <div className="fr-nav">
          <button
            type="button"
            className={cx('fr-play', playing && 'is-on')}
            onClick={togglePlay}
            title={playing ? '暂停' : '每 2.4 秒走一步'}
            aria-pressed={playing}
          >
            <span aria-hidden>{playing ? '❚❚' : '▸'}</span>
            {playing ? '暂停' : '播放'}
          </button>
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

      {branches.map((c) => {
        const forkName = stepById[c.branch?.atStepId ?? '']?.name
        return (
          <div className="fr-branch" key={c.id}>
            <div className="fr-branch-label" title={c.goal}>
              <span aria-hidden>↳</span>
              <b>{c.name}</b>
              <em>从「{forkName}」分叉</em>
            </div>
            <div className="fr-branch-beats">
              {beatsOf(c).map((b, i) => {
                const p = processById[b.processId]
                const m = p ? moduleById[p.moduleId] : null
                const s = stepById[b.stepId]
                if (!p || !m || !s) return null
                return (
                  <button
                    type="button"
                    key={`${b.processId}-${b.stepId}-${i}`}
                    className={cx('fr-beat', 'is-branch', selectedStepId === b.stepId && 'is-on')}
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
        )
      })}
    </aside>
  )
}
