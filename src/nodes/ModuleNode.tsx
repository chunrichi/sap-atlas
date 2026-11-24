import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { ModuleNode as ModuleNodeType } from '../graph/buildGraph'
import { MODULE_H, MODULE_W } from '../canvas/layout/layout'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

function ModuleNodeView({ data }: NodeProps<ModuleNodeType>) {
  const { module: m, processCount, stepCount } = data
  const focused = useViewStore((s) => s.focusedModuleId)
  const filterModule = useViewStore((s) => s.filter.moduleId)
  const { goModule } = useNavigate()

  const planned = m.status === 'planned'
  const dim = Boolean(focused) && focused !== m.id
  const active = focused === m.id
  const filteredOut = Boolean(filterModule) && filterModule !== m.id

  return (
    <div
      className={cx(
        'node-module',
        dim && 'is-dim',
        active && 'is-active',
        planned && 'is-planned',
        filteredOut && 'is-filter-dim',
      )}
      data-module={m.id}
      style={
        {
          width: MODULE_W,
          height: MODULE_H,
          '--accent': m.accent,
          '--soft': m.soft,
        } as React.CSSProperties
      }
    >
      <div className="module-face face-l0">
        <button
          type="button"
          className="module-hit"
          onClick={() => !planned && goModule(m.id)}
          disabled={planned}
        >
          <span className="module-code">{m.code}</span>
          <span className="module-name">{m.name}</span>
          <span className="module-l0-meta">
            {planned ? '规划中' : `${processCount} 条流程 · ${stepCount} 个步骤`}
          </span>
          {!planned && (
            <span className="module-l0-bars" aria-hidden>
              {Array.from({ length: Math.min(processCount, 4) }).map((_, i) => (
                <i key={i} />
              ))}
            </span>
          )}
        </button>
      </div>

      <div className="module-face face-l1">
        <button
          type="button"
          className="module-head"
          onClick={() => !planned && goModule(m.id)}
          disabled={planned}
        >
          <span className="module-head-code">{m.code}</span>
          <span className="module-head-name">{m.name}</span>
          {planned && <span className="module-head-tag">规划中</span>}
        </button>
        <p className="module-mission">{m.mission}</p>
      </div>
    </div>
  )
}

export default memo(ModuleNodeView)
