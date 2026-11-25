import { useEffect, useMemo, useRef, useState } from 'react'
import {
  KIND_LABEL,
  allObjects,
  moduleById,
  modules,
  processesByModule,
  processesOfStep,
  stepById,
  summarizeUsage,
} from '../data'
import type { DevObject, ModuleId, Process, SapModule, Step } from '../data/types'
import { OBJECT_TYPE_LABEL } from '../data/types'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

type StepRow = {
  key: string
  step: Step
  process: Process
  module: SapModule
  /** 在该流程内的序号 */
  order: number
  /** 同一步骤还出现在几条别的流程里 */
  alsoIn: number
}

/**
 * 清单是画布的「对照面」：
 * 画布适合建立结构感，清单适合扫读、比对、按字段找东西。
 * 两者共用同一份数据与同一个选中态，不是两套东西。
 */
export default function ListPanel() {
  const open = useViewStore((s) => s.listOpen)
  const setOpen = useViewStore((s) => s.setListOpen)
  const focusedModuleId = useViewStore((s) => s.focusedModuleId)
  const focusedProcessId = useViewStore((s) => s.focusedProcessId)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const openObject = useViewStore((s) => s.openObject)
  const { goModule, goProcess, goStep } = useNavigate()

  const [tab, setTab] = useState<'steps' | 'objects'>('steps')
  const [q, setQ] = useState('')
  const [follow, setFollow] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 每个「流程 × 步骤」实例一行：同一步骤在两处出现时必须是两行，
  // 否则「点一行定位」会有歧义
  const rows = useMemo<StepRow[]>(() => {
    const out: StepRow[] = []
    for (const m of modules) {
      for (const p of processesByModule[m.id] ?? []) {
        const sorted = [...p.lanes].sort((a, b) => a.col - b.col || a.row - b.row)
        sorted.forEach((lane, i) => {
          const step = stepById[lane.stepId]
          if (!step) return
          out.push({
            key: `${p.id}::${step.id}`,
            step,
            process: p,
            module: m,
            order: i + 1,
            alsoIn: (processesOfStep[step.id]?.length ?? 0) - 1,
          })
        })
      }
    }
    return out
  }, [])

  const scope = follow ? focusedModuleId : null
  const needle = q.trim().toLowerCase()

  const stepHits = useMemo(
    () =>
      rows.filter((r) => {
        if (scope && r.module.id !== scope) return false
        if (!needle) return true
        return (
          r.step.name.toLowerCase().includes(needle) ||
          (r.step.tcode ?? '').toLowerCase().includes(needle) ||
          r.process.name.toLowerCase().includes(needle) ||
          r.step.role.toLowerCase().includes(needle)
        )
      }),
    [rows, scope, needle],
  )

  const objHits = useMemo(
    () =>
      allObjects.filter((o) => {
        if (!needle) return true
        return (
          o.techName.toLowerCase().includes(needle) ||
          o.title.toLowerCase().includes(needle) ||
          OBJECT_TYPE_LABEL[o.type].toLowerCase().includes(needle)
        )
      }),
    [needle],
  )

  // 图 → 表：画布上选中某一步，清单滚到那一行
  useEffect(() => {
    if (!open || tab !== 'steps' || !selectedStepId) return
    const el = bodyRef.current?.querySelector('.lp-row.is-on')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open, tab, selectedStepId, focusedProcessId, stepHits.length])

  // 面板开合会改变画布可视区，重新取景一次，别把当前内容留在面板底下
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      if (selectedStepId && focusedProcessId) {
        goStep(focusedProcessId, selectedStepId, { history: false })
      } else if (focusedProcessId) {
        goProcess(focusedProcessId, { history: false })
      } else if (focusedModuleId) {
        goModule(focusedModuleId, { history: false })
      }
    }, 80)
    return () => window.clearTimeout(t)
    // 只在开合时重取景；用户自己平移的时候不要抢镜头
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <aside className="list-panel" aria-label="清单视图">
      <header className="lp-head">
        <div className="lp-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'steps'}
            className={cx('lp-tab', tab === 'steps' && 'is-on')}
            onClick={() => setTab('steps')}
          >
            步骤 <em>{stepHits.length}</em>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'objects'}
            className={cx('lp-tab', tab === 'objects' && 'is-on')}
            onClick={() => setTab('objects')}
          >
            开发对象 <em>{objHits.length}</em>
          </button>
        </div>
        <button type="button" className="lp-close" onClick={() => setOpen(false)} aria-label="关闭清单">
          ✕
        </button>
      </header>

      <div className="lp-tools">
        <input
          className="lp-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === 'steps' ? '步骤名 / 事务码 / 角色…' : '技术名 / 说明 / 类型…'}
          spellCheck={false}
        />
        {tab === 'steps' && (
          <button
            type="button"
            className={cx('lp-scope', follow && 'is-on')}
            onClick={() => setFollow(!follow)}
            title={focusedModuleId ? '只列当前模块的步骤' : '当前没有聚焦模块，显示全部'}
          >
            跟随画布
          </button>
        )}
      </div>

      <div className="lp-body" ref={bodyRef}>
        {tab === 'steps' &&
          (stepHits.length === 0 ? (
            <div className="lp-empty">没有匹配的步骤。</div>
          ) : (
            <StepTable rows={stepHits} onPick={goStep} onProcess={goProcess} />
          ))}
        {tab === 'objects' &&
          (objHits.length === 0 ? (
            <div className="lp-empty">没有匹配的对象。</div>
          ) : (
            <ObjectTable rows={objHits} onPick={openObject} onModule={goModule} />
          ))}
      </div>

      <footer className="lp-foot">
        <span>点一行在图上定位</span>
        <span>
          <kbd>L</kbd> 收起
        </span>
      </footer>
    </aside>
  )
}

function StepTable({
  rows,
  onPick,
  onProcess,
}: {
  rows: StepRow[]
  onPick: (processId: string, stepId: string) => void
  onProcess: (processId: string) => void
}) {
  const selected = useViewStore((s) => s.selectedStepId)
  const focusedProcess = useViewStore((s) => s.focusedProcessId)
  let lastModule = ''

  return (
    <div className="lp-table">
      {rows.map((r) => {
        const head = r.module.id !== lastModule ? r.module : null
        lastModule = r.module.id
        return (
          <div key={r.key}>
            {head && (
              <div className="lp-group" style={{ ['--accent' as string]: head.accent }}>
                <i />
                <b>{head.code}</b>
                <span>{head.name}</span>
              </div>
            )}
            <div
              className={cx(
                'lp-row',
                selected === r.step.id && focusedProcess === r.process.id && 'is-on',
              )}
            >
              <button
                type="button"
                className="lp-row-main"
                onClick={() => onPick(r.process.id, r.step.id)}
                title={`${r.step.name} · ${r.process.name}`}
              >
                <span className="lp-dot" data-kind={r.step.kind} />
                <span className="lp-name">{r.step.name}</span>
                <span className="lp-tcode">{r.step.tcode ?? '—'}</span>
                <span className="lp-kind">{KIND_LABEL[r.step.kind]}</span>
                <span className="lp-obj">{r.step.objectIds.length}</span>
                {r.alsoIn > 0 && <span className="lp-also">↗{r.alsoIn}</span>}
              </button>
              <button
                type="button"
                className="lp-proc"
                onClick={() => onProcess(r.process.id)}
                title={`只看「${r.process.name}」这条流程`}
              >
                {r.process.name}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ObjectTable({
  rows,
  onPick,
  onModule,
}: {
  rows: DevObject[]
  onPick: (id: string) => void
  onModule: (id: ModuleId) => void
}) {
  return (
    <div className="lp-table">
      {rows.map((o) => {
        const u = summarizeUsage(o.id)
        const mod = u.moduleIds[0] ? moduleById[u.moduleIds[0]] : null
        return (
          <div key={o.id} className="lp-row is-obj">
            <button type="button" className="lp-row-main" onClick={() => onPick(o.id)}>
              <span className="lp-type" data-type={o.type}>
                {OBJECT_TYPE_LABEL[o.type]}
              </span>
              <span className="lp-objmain">
                <b>{o.techName}</b>
                <em>{o.title}</em>
              </span>
              <span className="lp-usage" title={`${u.stepCount} 个步骤 · ${u.processCount} 条流程`}>
                {u.stepCount} 步 / {u.processCount} 流程
              </span>
            </button>
            {mod && (
              <button
                type="button"
                className="lp-mod"
                style={{ ['--accent' as string]: mod.accent }}
                onClick={() => onModule(mod.id)}
                title={`回 ${mod.code} 模块`}
              >
                {mod.code}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
