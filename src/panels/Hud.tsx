import { useViewStore } from '../state/viewStore'
import { moduleById, processById, stepById } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { LOD_LABEL } from '../canvas/lod/lod.config'
import { cx } from '../lib/cx'
import ImpactChip from './ImpactChip'
import FilterBar from './FilterBar'

export default function Hud() {
  const focusedModuleId = useViewStore((s) => s.focusedModuleId)
  const focusedProcessId = useViewStore((s) => s.focusedProcessId)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const lod = useViewStore((s) => s.lod)
  const setSearchOpen = useViewStore((s) => s.setSearchOpen)
  const flowOpen = useViewStore((s) => s.flowOpen)
  const setFlowOpen = useViewStore((s) => s.setFlowOpen)
  const { goHome, goModule, goProcess } = useNavigate()

  const mod = focusedModuleId ? moduleById[focusedModuleId] : null
  const proc = focusedProcessId ? processById[focusedProcessId] : null
  const step = selectedStepId ? stepById[selectedStepId] : null

  return (
    <>
      <header className="hud-top">
        <button type="button" className="brand" onClick={() => goHome()}>
          <span className="brand-mark" />
          <span className="brand-text">
            <b>SAP Map</b>
            <em>业务流程知识地图</em>
          </span>
        </button>

        <nav className="crumb" aria-label="当前位置">
          <button type="button" className={cx('crumb-item', !mod && 'is-current')} onClick={() => goHome()}>
            全部模块
          </button>
          {mod && (
            <>
              <span className="crumb-sep">/</span>
              <button
                type="button"
                className={cx('crumb-item', mod && !proc && 'is-current')}
                onClick={() => goModule(mod.id)}
                style={{ ['--accent' as string]: mod.accent }}
              >
                {mod.code} {mod.name}
              </button>
            </>
          )}
          {proc && (
            <>
              <span className="crumb-sep">/</span>
              <button
                type="button"
                className={cx('crumb-item', !step && 'is-current')}
                onClick={() => goProcess(proc.id)}
              >
                {proc.name}
              </button>
            </>
          )}
          {step && (
            <>
              <span className="crumb-sep">/</span>
              <span className="crumb-item is-current">{step.name}</span>
            </>
          )}
        </nav>

        <ImpactChip />

        <button type="button" className="hud-search" onClick={() => setSearchOpen(true)}>
          <span aria-hidden>⌕</span>
          搜索知识库
          <kbd>⌘K</kbd>
        </button>
      </header>

      <div className="hud-bottom" data-flow={flowOpen ? 'open' : 'closed'}>
        <div className="lod-meter" aria-label={`当前层级 ${LOD_LABEL[lod]}`}>
          {LOD_LABEL.map((label, i) => (
            <span key={label} className={cx('lod-dot', i === lod && 'is-on')}>
              <i />
              {label}
            </span>
          ))}
        </div>
        <FilterBar />
        <div className="legend">
          <span className="legend-item" data-kind="human">
            <i /> 人工
          </span>
          <span className="legend-item" data-kind="system">
            <i /> 系统
          </span>
          <span className="legend-item" data-kind="document">
            <i /> 单据
          </span>
          <span className="legend-item" data-kind="alt">
            <i /> 异常分支
          </span>
        </div>
        <button
          type="button"
          className={cx('flow-toggle', flowOpen && 'is-on')}
          onClick={() => setFlowOpen(!flowOpen)}
          title="端到端主线（F）"
        >
          主线 <kbd>F</kbd>
        </button>
      </div>

      <div className="hud-hint">
        <b>点击模块进入</b> · 滚轮缩放看细节 · 悬停步骤看开发对象 · <kbd>⌘K</kbd> 搜索
      </div>
    </>
  )
}
