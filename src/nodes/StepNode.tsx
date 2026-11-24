import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StepFlowNode } from '../graph/buildGraph'
import { STEP_H, STEP_W } from '../canvas/layout/layout'
import { KIND_LABEL } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { cx } from '../lib/cx'

function StepNodeView({ data }: NodeProps<StepFlowNode>) {
  const { step, process, module: m, order, objectCount, alsoIn } = data
  const focusedProcess = useViewStore((s) => s.focusedProcessId)
  const hoveredStepId = useViewStore((s) => s.hover?.stepId ?? null)
  const hoverStep = useViewStore((s) => s.hoverStep)
  const scheduleHide = useViewStore((s) => s.scheduleHide)
  const { goStep } = useNavigate()

  const linked = hoveredStepId === step.id
  const soft = Boolean(focusedProcess) && focusedProcess !== process.id

  return (
    <div
      className={cx(
        'node-step',
        linked && 'is-linked',
        soft && 'is-soft',
      )}
      data-kind={step.kind}
      style={
        {
          width: STEP_W,
          height: STEP_H,
          '--accent': m.accent,
          '--soft': m.soft,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        hoverStep({ stepId: step.id, processId: process.id, x: r.right, y: r.top })
      }}
      onMouseLeave={scheduleHide}
      onClick={() => goStep(process.id, step.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') goStep(process.id, step.id)
      }}
    >
      <Handle type="target" position={Position.Left} className="rf-handle-hidden" />
      <Handle type="source" position={Position.Right} className="rf-handle-hidden" />

      <span className="step-order">{order}</span>
      <span className="step-title">{step.name}</span>
      <span className="step-meta">
        {step.tcode ? <em>{step.tcode}</em> : KIND_LABEL[step.kind]}
        {step.tcode && step.kind === 'system' ? null : null}
      </span>
      <span className="step-obj">{objectCount} 个开发对象</span>
      {alsoIn.length > 0 && (
        <span className="step-also" title={`也出现在：${alsoIn.join('、')}`}>
          ↗{alsoIn.length}
        </span>
      )}
    </div>
  )
}

export default memo(StepNodeView)
