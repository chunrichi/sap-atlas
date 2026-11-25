import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StepFlowNode } from '../graph/buildGraph'
import { STEP_H, STEP_W } from '../canvas/layout/layout'
import { KIND_LABEL } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'
import { filterActive, stepMatches } from '../lib/filter'
import { cx } from '../lib/cx'

function StepNodeView({ data }: NodeProps<StepFlowNode>) {
  const { step, process, module: m, home, order, objectCount, alsoIn } = data
  const focusedProcess = useViewStore((s) => s.focusedProcessId)
  const hoveredStepId = useViewStore((s) => s.hover?.stepId ?? null)
  const hoverStep = useViewStore((s) => s.hoverStep)
  const scheduleHide = useViewStore((s) => s.scheduleHide)
  const impactId = useViewStore((s) => s.impactObjectId)
  const coarse = useViewStore((s) => s.coarse)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const selectStep = useViewStore((s) => s.selectStep)
  const filter = useViewStore((s) => s.filter)
  const path = useViewStore((s) => s.path)
  const { goStep } = useNavigate()

  const borrowed = home.id !== m.id
  const linked = hoveredStepId === step.id
  const soft = Boolean(focusedProcess) && focusedProcess !== process.id
  const impact = impactId ? step.objectIds.includes(impactId) : null
  const filteredOut = filterActive(filter) && !stepMatches(step, m.id, filter)
  const isSelected = selectedStepId === step.id
  // 路径按 stepId 判断：同一步骤在别的流程里也是同一个知识点
  const onPath = path ? path.some((n) => n.stepId === step.id) : null

  /** 触屏没有 hover：把卡片锚在卡片自身位置，由卡片自己改成底部抽屉 */
  const anchorCard = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    hoverStep({
      stepId: step.id,
      processId: process.id,
      x: r.right,
      y: r.top,
      w: r.width,
      h: r.height,
    })
  }

  return (
    <div
      className={cx(
        'node-step',
        linked && 'is-linked',
        soft && 'is-soft',
        impact === true && 'is-impact',
        impact === false && 'is-impact-dim',
        filteredOut && 'is-filter-dim',
        isSelected && 'is-selected',
        onPath === true && 'is-path',
        onPath === false && 'is-path-dim',
      )}
      data-kind={step.kind}
      style={
        {
          width: STEP_W,
          height: STEP_H,
          '--accent': home.accent,
          '--soft': home.soft,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        if (coarse) return
        const r = e.currentTarget.getBoundingClientRect()
        hoverStep({
          stepId: step.id,
          processId: process.id,
          x: r.right,
          y: r.top,
          w: r.width,
          h: r.height,
        })
      }}
      onMouseLeave={coarse ? undefined : scheduleHide}
      onClick={(e) => {
        // 触屏：第一次点按只"看"，第二次才下钻——否则手指一碰就飞走，回不来
        if (coarse && !isSelected) {
          e.preventDefault()
          anchorCard(e.currentTarget)
          selectStep(step.id)
          return
        }
        goStep(process.id, step.id)
      }}
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
        {borrowed && (
          <em className="step-from" title={`这一步属于 ${home.code} ${home.name}`}>
            {home.code}
          </em>
        )}
        {step.tcode ? <em>{step.tcode}</em> : KIND_LABEL[step.kind]}
      </span>
      <span className="step-obj">{objectCount} 个开发对象</span>
      {alsoIn.length > 0 && (
        <span
          className="step-also"
          title={`原属 ${home.code} ${home.name}；也出现在：${alsoIn.join('、')}`}
        >
          ↗{alsoIn.length}
        </span>
      )}
    </div>
  )
}

export default memo(StepNodeView)
