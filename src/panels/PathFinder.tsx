import { useEffect, useMemo, useRef, useState } from 'react'
import { allSteps, moduleById, processById, processesOfStep, stepById } from '../data'
import { findPath, resolveRef } from '../lib/path'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

/**
 * 任意两点路径。
 * 入口的难点不是算法，是「谁先谁后」：所以起点默认取当前选中的步骤，
 * 用户只需要回答「走到哪儿」。
 */
export default function PathFinder() {
  const open = useViewStore((s) => s.pathOpen)
  const from = useViewStore((s) => s.pathFrom)
  const to = useViewStore((s) => s.pathTo)
  const path = useViewStore((s) => s.path)
  const miss = useViewStore((s) => s.pathMiss)
  const setPathEnd = useViewStore((s) => s.setPathEnd)
  const setPath = useViewStore((s) => s.setPath)
  const closePath = useViewStore((s) => s.closePath)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const focusedProcessId = useViewStore((s) => s.focusedProcessId)
  const { goStep } = useNavigate()

  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  // 两端都齐了就算：结果直接进 store，画布据此压暗其它步骤
  useEffect(() => {
    if (!from || !to) {
      setPath(null)
      return
    }
    const r = findPath(from, to)
    setPath(r, !r)
  }, [from, to, setPath])

  const suggestions = useMemo(() => {
    if (!open) return []
    const needle = q.trim().toLowerCase()
    return allSteps
      .filter((s) => s.id !== from?.stepId)
      .filter((s) => {
        if (!needle) return false
        return (
          s.name.toLowerCase().includes(needle) ||
          (s.tcode ?? '').toLowerCase().includes(needle)
        )
      })
      .slice(0, 8)
      .map((s) => {
        const inst = processesOfStep[s.id]?.[0]
        const m = inst ? moduleById[inst.moduleId] : null
        return { step: s, processId: inst?.id ?? '', module: m }
      })
      .filter((x) => x.processId)
  }, [open, q, from?.stepId])

  useEffect(() => {
    setIdx(0)
  }, [q])

  if (!open) return null

  const fromStep = from ? stepById[from.stepId] : null
  const fromProcess = from ? processById[from.processId] : null
  const fromModule = fromProcess ? moduleById[fromProcess.moduleId] : null

  const canUseCurrent =
    Boolean(selectedStepId) &&
    Boolean(focusedProcessId) &&
    (selectedStepId !== from?.stepId || focusedProcessId !== from?.processId)

  const pick = (stepId: string) => {
    const ref = resolveRef(stepId, processesOfStep[stepId]?.[0]?.id)
    if (!ref) return
    setPathEnd('to', ref)
    setQ('')
  }

  const swap = () => {
    if (!from || !to) return
    setPathEnd('from', to)
    setPathEnd('to', from)
  }

  const hops = path ? path.length - 1 : 0
  const moduleCount = path
    ? new Set(
        path
          .map((n) => processById[n.processId]?.moduleId)
          .filter((x): x is NonNullable<typeof x> => Boolean(x)),
      ).size
    : 0

  return (
    <section className="path-panel" aria-label="两点路径">
      <header className="pp-head">
        <span className="pp-tag">路径</span>
        <span className="pp-hint">从哪一步走到哪一步，中间经过什么</span>
        <button type="button" className="pp-close" onClick={closePath} aria-label="关闭">
          ✕
        </button>
      </header>

      <div className="pp-ends">
        <div className="pp-end" style={{ ['--accent' as string]: fromModule?.accent ?? '#64748b' }}>
          <em>起点</em>
          {fromStep ? (
            <b>
              {fromModule && <span className="pp-mod">{fromModule.code}</span>}
              {fromStep.name}
            </b>
          ) : (
            <span className="pp-none">未选（先在图上点一个步骤）</span>
          )}
          {canUseCurrent && (
            <button
              type="button"
              className="pp-use"
              onClick={() =>
                setPathEnd('from', resolveRef(selectedStepId!, focusedProcessId) ?? null)
              }
            >
              用当前选中
            </button>
          )}
        </div>

        <span className="pp-arrow" aria-hidden>
          →
        </span>

        <div className="pp-end is-to">
          <em>终点</em>
          <input
            ref={inputRef}
            className="pp-input"
            value={q}
            placeholder={from ? '搜步骤名或事务码…' : '先确定起点'}
            disabled={!from}
            spellCheck={false}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(i + 1, suggestions.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                const s = suggestions[idx]
                if (s) pick(s.step.id)
              }
            }}
          />
          {to && <span className="pp-to-name">{stepById[to.stepId]?.name}</span>}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="pp-sugs">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s.step.id}
              className={cx('pp-sug', i === idx && 'is-on')}
              onMouseEnter={() => setIdx(i)}
              onClick={() => pick(s.step.id)}
            >
              <span
                className="pp-mod"
                style={{ ['--accent' as string]: s.module?.accent ?? '#64748b' }}
              >
                {s.module?.code}
              </span>
              <b>{s.step.name}</b>
              <em>{s.step.tcode ?? ''}</em>
            </button>
          ))}
        </div>
      )}

      {from && to && (
        <div className="pp-result">
          {path ? (
            <>
              <div className="pp-stat">
                {hops} 跳 · 经 {moduleCount} 个模块
              </div>
              <div className="pp-chain">
                {path.map((n, i) => {
                  const s = stepById[n.stepId]
                  const p = processById[n.processId]
                  const m = p ? moduleById[p.moduleId] : null
                  return (
                    <span className="pp-hop" key={`${n.processId}-${n.stepId}-${i}`}>
                      {i > 0 && <span className="pp-link" aria-hidden>→</span>}
                      <button
                        type="button"
                        className="pp-node"
                        style={{ ['--accent' as string]: m?.accent ?? '#64748b' }}
                        onClick={() => goStep(n.processId, n.stepId)}
                        title={`${p?.name ?? ''} · ${s?.name ?? ''}`}
                      >
                        <span className="pp-mod">{m?.code}</span>
                        <b>{s?.name}</b>
                        {n.via.length > 0 && <i>经 {n.via.length} 次交接</i>}
                      </button>
                    </span>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="pp-miss">
              这两步之间没有正向可达的流向。
              <button type="button" className="pp-use" onClick={swap}>
                反过来试试
              </button>
            </div>
          )}
        </div>
      )}

      {!to && from && <div className="pp-empty">输入终点步骤，回车确定。</div>}
      {!from && <div className="pp-empty">点画布或清单里的一个步骤作为起点，再打开这里。</div>}
    </section>
  )
}
