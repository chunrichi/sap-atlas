import { memo } from 'react'
import { getBezierPath, type EdgeProps } from '@xyflow/react'
import { useViewStore } from '../../state/viewStore'
import { cx } from '../../lib/cx'

function FlowEdgeView({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  // 上下错位大时用更宽的弧线，避免贴着卡片边缘走
  const curvature = Math.abs(targetY - sourceY) > 70 ? 0.5 : 0.2
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  })

  const kind = (data?.kind as string) ?? 'flow'
  const moduleId = data?.moduleId as string | undefined
  const focusedModule = useViewStore((s) => s.focusedModuleId)
  const dim = Boolean(focusedModule) && moduleId !== focusedModule

  return (
    <g className={cx('edge-group', dim && 'is-dim')}>
      <path d={path} className={cx('edge-line', `kind-${kind}`)} fill="none" />
      <path d={path} className={cx('edge-spark', `kind-${kind}`)} fill="none" />
    </g>
  )
}

export default memo(FlowEdgeView)
