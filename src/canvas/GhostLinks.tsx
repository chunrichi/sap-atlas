import { useMemo } from 'react'
import { ViewportPortal, useViewport } from '@xyflow/react'
import { moduleById, processById } from '../data'
import { worldBounds } from './layout/layout'
import { instancesOf, toScreen } from './ghost'
import { useViewStore } from '../state/viewStore'

/**
 * 幽灵锚点：悬停/选中一个步骤时，把它在其他流程、其他模块里的落位连出来。
 * 只画落在视口内的目标 —— 视口外的交给 GhostCompass（屏幕边缘的方向标）。
 */
export default function GhostLinks() {
  const hover = useViewStore((s) => s.hover)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const size = useViewStore((s) => s.size)
  const vp = useViewport()

  const stepId = hover?.stepId ?? selectedStepId
  const active = hover?.processId ?? null

  const { from, others } = useMemo(() => {
    if (!stepId) return { from: null, others: [] as ReturnType<typeof instancesOf> }
    const all = instancesOf(stepId)
    if (all.length < 2) return { from: null, others: [] as ReturnType<typeof instancesOf> }
    const src = (active && all.find((i) => i.processId === active)) || all[0]
    const visible = all
      .filter((i) => i !== src)
      .filter((i) => {
        const p = toScreen(i.rect, vp)
        return p.x > 0 && p.x < size.w && p.y > 0 && p.y < size.h
      })
    return { from: src, others: visible }
  }, [stepId, active, vp, size.w, size.h])

  if (!from || others.length === 0) return null

  const b = worldBounds()
  const x1 = from.rect.x + from.rect.w / 2
  const y1 = from.rect.y
  // 标记按屏幕像素固定大小，反向抵消画布缩放
  const inv = 1 / Math.max(vp.zoom, 0.05)

  return (
    <ViewportPortal>
      <svg className="ghost-layer" width={b.w} height={b.h} viewBox={`0 0 ${b.w} ${b.h}`} aria-hidden>
        {others.map((o, i) => {
          const x2 = o.rect.x + o.rect.w / 2
          const y2 = o.rect.y
          const accent = moduleById[o.moduleId]?.accent ?? '#64748b'
          const dx = Math.abs(x2 - x1)
          const lift = Math.min(320, 90 + dx * 0.09)
          const path = `M ${x1} ${y1} C ${x1} ${y1 - lift}, ${x2} ${y2 - lift}, ${x2} ${y2}`
          const sameModule = o.moduleId === from.moduleId
          return (
            <g key={`${o.processId}-${o.order}-${i}`}>
              <path
                d={path}
                className="ghost-link"
                stroke={sameModule ? 'rgba(100,116,139,0.55)' : accent}
                style={{ animationDelay: `${i * 120}ms` }}
              />
              <g transform={`translate(${x2} ${y2}) scale(${inv})`}>
                <circle r={15} fill="#fff" stroke={accent} strokeWidth={2} className="ghost-pin" />
                <text y={4} textAnchor="middle" fontSize={10} fontWeight={700} fill={accent} fontFamily="var(--mono)">
                  {moduleById[o.moduleId]?.code ?? '?'}
                </text>
                <text y={-24} textAnchor="middle" fontSize={9.5} fill="rgba(16,24,40,0.55)" className="ghost-caption">
                  {processById[o.processId]?.name ?? ''}
                </text>
              </g>
            </g>
          )
        })}
      </svg>
    </ViewportPortal>
  )
}
