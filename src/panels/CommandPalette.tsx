import { useEffect, useMemo, useRef, useState } from 'react'
import { allObjects, allSteps, moduleById, processById, processes, processesOfStep } from '../data'
import { OBJECT_TYPE_LABEL } from '../data/types'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

type Hit = {
  key: string
  tag: string
  label: string
  sub: string
  moduleId: string
  run: () => void
}

function score(primary: string, secondary: string, q: string): number {
  if (!q) return 0
  const p = primary.toLowerCase()
  const idx = p.indexOf(q)
  if (idx === 0) return 100
  if (idx > 0) return 70 - Math.min(idx, 40)
  if (secondary.toLowerCase().includes(q)) return 20
  return -1
}

export default function CommandPalette() {
  const [query, setQuery] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { goProcess, goStep } = useNavigate()
  const openObject = useViewStore((s) => s.openObject)
  const open = useViewStore((s) => s.searchOpen)
  const setOpen = useViewStore((s) => s.setSearchOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useViewStore.getState().searchOpen)
        setQuery('')
        setIdx(0)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    const scored: Array<{ s: number; hit: Hit }> = []
    const push = (s: number, hit: Hit) => {
      if (s >= 0) scored.push({ s, hit })
    }

    for (const p of processes) {
      const m = moduleById[p.moduleId]
      push(score(`${p.name} ${m.code}`, `${p.goal} ${p.trigger}`, q), {
        key: `proc:${p.id}`,
        tag: `流程 · ${m.code}`,
        label: p.name,
        sub: `${p.lanes.length} 个步骤 · ${p.outcome}`,
        moduleId: m.id,
        run: () => {
          goProcess(p.id)
          setOpen(false)
        },
      })
    }

    for (const s of allSteps) {
      const inst = processesOfStep[s.id]?.[0]
      if (!inst) continue
      const m = moduleById[inst.moduleId]
      const primary = `${s.name} ${s.tcode ?? ''}`
      const base = score(primary, `${s.intent} ${s.role} ${s.output ?? ''}`, q)
      const tcBonus = q && s.tcode && s.tcode.toLowerCase().includes(q) ? 45 : 0
      push(base < 0 ? -1 : base + tcBonus, {
        key: `step:${s.id}`,
        tag: `步骤 · ${m.code}`,
        label: s.name,
        sub: `${s.tcode ? s.tcode + ' · ' : ''}${m.name} / ${inst.name}`,
        moduleId: m.id,
        run: () => {
          goStep(inst.id, s.id)
          setOpen(false)
        },
      })
    }

    for (const o of allObjects) {
      push(score(`${o.techName} ${o.title}`, `${o.purpose} ${OBJECT_TYPE_LABEL[o.type]}`, q), {
        key: `obj:${o.id}`,
        tag: OBJECT_TYPE_LABEL[o.type],
        label: o.techName,
        sub: o.title,
        moduleId: '',
        run: () => {
          openObject(o.id)
          setOpen(false)
        },
      })
    }

    scored.sort((a, b) => b.s - a.s)
    return scored.slice(0, q ? 26 : 14).map((x) => x.hit)
  }, [query, goProcess, goStep, openObject])

  useEffect(() => {
    setIdx(0)
  }, [query])

  if (!open) return null

  const move = (d: number) => setIdx((i) => (i + d + hits.length) % Math.max(hits.length, 1))

  return (
    <div className="cmdk-scrim" onMouseDown={() => setOpen(false)}>
      <div
        className="cmdk"
        role="dialog"
        aria-label="搜索知识库"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            move(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            hits[idx]?.run()
          }
        }}
      >
        <div className="cmdk-search">
          <span className="cmdk-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜步骤、事务码、流程或开发对象…"
            spellCheck={false}
          />
          <kbd>ESC</kbd>
        </div>

        <div className="cmdk-list">
          {hits.length === 0 && <div className="cmdk-empty">没有匹配项。试试 VA01、MIGO、MSEG 或「收货」。</div>}
          {hits.map((h, i) => (
            <button
              type="button"
              key={h.key}
              className={cx('cmdk-item', i === idx && 'is-on')}
              onMouseEnter={() => setIdx(i)}
              onClick={h.run}
            >
              <span className="cmdk-tag">{h.tag}</span>
              <span className="cmdk-main">
                <b>{h.label}</b>
                <em>{h.sub}</em>
              </span>
            </button>
          ))}
        </div>

        <div className="cmdk-foot">
          <span>↑↓ 选择</span>
          <span>↵ 打开</span>
          <span>⌘K 关闭</span>
          <span className="cmdk-count">{hits.length} 条</span>
        </div>
      </div>
    </div>
  )
}
