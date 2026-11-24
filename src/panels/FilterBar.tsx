import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modules, processes, stepById } from '../data'
import type { ModuleId, StepKind } from '../data/types'
import { filterActive, stepMatches } from '../lib/filter'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

const KINDS: Array<{ id: StepKind; label: string }> = [
  { id: 'human', label: '人工' },
  { id: 'system', label: '系统' },
  { id: 'document', label: '单据' },
]

/**
 * 筛选器：压暗而不是隐藏。
 * 保留所有卡片的位置，用户仍然能"记住"东西在哪，
 * 只是当前不关心的部分退到背景里。
 */
export default function FilterBar() {
  const filter = useViewStore((s) => s.filter)
  const setFilter = useViewStore((s) => s.setFilter)
  const clearFilter = useViewStore((s) => s.clearFilter)
  const offGrid = useViewStore((s) => s.offGrid)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, bottom: 0, width: 372 })
  const ref = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  // 弹层挂在 body 上：底栏有 backdrop-filter，会让 fixed 子元素相对底栏定位
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const btn = ref.current?.querySelector('.filter-toggle') as HTMLElement | null
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const width = Math.min(372, window.innerWidth - 24)
      const left = Math.max(
        12,
        Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - 12 - width),
      )
      setPos({ left, bottom: window.innerHeight - r.top + 12, width })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open])

  // 画布已经空了的时候，筛选面板会挡住「回到内容」，先收起来
  useEffect(() => {
    if (offGrid) setOpen(false)
  }, [offGrid])

  const active = filterActive(filter)

  const { total, matched } = useMemo(() => {
    let t = 0
    let n = 0
    for (const p of processes) {
      for (const lane of p.lanes) {
        const s = stepById[lane.stepId]
        if (!s) continue
        t++
        if (stepMatches(s, p.moduleId, filter)) n++
      }
    }
    return { total: t, matched: n }
  }, [filter])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const toggleKind = (k: StepKind) => {
    const has = filter.kinds.includes(k)
    setFilter({ kinds: has ? filter.kinds.filter((x) => x !== k) : [...filter.kinds, k] })
  }

  return (
    <div className="filter-wrap" ref={ref}>
      <button
        type="button"
        className={cx('filter-toggle', active && 'is-on')}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="按类型 / 模块 / 是否有增强筛步骤"
      >
        筛选
        {active && (
          <em>
            {matched}/{total}
          </em>
        )}
      </button>

      {open &&
        createPortal(
          <div
            className="filter-pop"
            ref={popRef}
            role="dialog"
            aria-label="筛选步骤"
            style={{ left: pos.left, bottom: pos.bottom, width: pos.width }}
          >
          <div className="fp-row">
            <span className="fp-label">步骤类型</span>
            <div className="fp-chips">
              {KINDS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  className={cx('fp-chip', filter.kinds.includes(k.id) && 'is-on')}
                  data-kind={k.id}
                  onClick={() => toggleKind(k.id)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fp-row">
            <span className="fp-label">所属模块</span>
            <div className="fp-chips">
              {modules.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  className={cx('fp-chip', 'fp-mod', filter.moduleId === m.id && 'is-on')}
                  style={{ ['--accent' as string]: m.accent }}
                  onClick={() =>
                    setFilter({ moduleId: filter.moduleId === m.id ? null : (m.id as ModuleId) })
                  }
                >
                  <i />
                  {m.code}
                </button>
              ))}
            </div>
          </div>

          <div className="fp-row">
            <span className="fp-label">开发相关</span>
            <div className="fp-chips">
              <button
                type="button"
                className={cx('fp-chip', filter.onlyBadi && 'is-on')}
                onClick={() => setFilter({ onlyBadi: !filter.onlyBadi })}
              >
                只看有 BAdI / 增强的步骤
              </button>
            </div>
          </div>

          <div className="fp-foot">
            <span>
              命中 <b>{matched}</b> / {total} 个步骤
            </span>
            <button type="button" className="fp-reset" onClick={clearFilter} disabled={!active}>
              清除筛选
            </button>
          </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
