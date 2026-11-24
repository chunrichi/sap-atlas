import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import type { LaneNode as LaneNodeType } from '../graph/buildGraph'
import { LANE_H, LANE_W } from '../canvas/layout/layout'
import { processesByModule } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

function LaneNodeView({ data }: NodeProps<LaneNodeType>) {
  const { process: p, module: m, stepCount } = data
  const focusedModule = useViewStore((s) => s.focusedModuleId)
  const focusedProcess = useViewStore((s) => s.focusedProcessId)
  const { goProcess } = useNavigate()

  const index = (processesByModule[m.id] ?? []).findIndex((x) => x.id === p.id) + 1
  const dim = Boolean(focusedModule) && focusedModule !== m.id
  const soft = Boolean(focusedProcess) && focusedProcess !== p.id && focusedModule === m.id

  return (
    <div
      className={cx('node-lane', dim && 'is-dim', soft && 'is-soft', focusedProcess === p.id && 'is-active')}
      style={
        {
          width: LANE_W,
          height: LANE_H,
          '--accent': m.accent,
          '--soft': m.soft,
        } as React.CSSProperties
      }
    >
      <button type="button" className="lane-head" onClick={() => goProcess(p.id)}>
        <span className="lane-index">{String(index).padStart(2, '0')}</span>
        <span className="lane-title">{p.name}</span>
        <span className="lane-count">{stepCount} 步</span>
      </button>
      <p className="lane-goal">{p.goal}</p>
    </div>
  )
}

export default memo(LaneNodeView)
