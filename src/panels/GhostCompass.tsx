import { useMemo } from 'react'
import { useViewport } from '@xyflow/react'
import { moduleById, processById } from '../data'
import { instancesOf, toScreen } from '../canvas/ghost'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { useViewStore } from '../state/viewStore'

/**
 * 视口外的幽灵锚点：在屏幕边缘给出「同一步骤还在那个方向」的方向标。
 * 没有它，跨模块的虚线会直接画到屏幕外，用户不知道指哪儿。
 */
export default function GhostCompass() {
  const hover = useViewStore((s) => s.hover)
  const selectedStepId = useViewStore((s) => s.selectedStepId)
  const focusedProcessId = useViewStore((s) => s.focusedProcessId)
  const size = useViewStore((s) => s.size)
  const vp = useViewport()
  const { goProcess } = useNavigate()

  const stepId = hover?.stepId ?? selectedStepId
  const active = hover?.processId ?? focusedProcessId

  const marks = useMemo(() => {
    if (!stepId || size.w < 100) return []
    const all = instancesOf(stepId)
    if (all.length < 2) return []
    const inView = (i: (typeof all)[number]) => {
      const p = toScreen(i.rect, vp)
      return p.x > 40 && p.x < size.w - 40 && p.y > 40 && p.y < size.h - 40
    }
    const src = (active && all.find((i) => i.processId === active)) || all.find(inView)
    if (!src) return []
    return all
      .filter((i) => i !== src)
      .map((i) => {
        const p = toScreen(i.rect, vp)
        const inside = p.x > 40 && p.x < size.w - 40 && p.y > 40 && p.y < size.h - 40
        if (inside) return null
        const dx = p.x - size.w / 2
        const dy = p.y - size.h / 2
        const dir =
          Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
        return {
          key: `${i.processId}-${i.order}`,
          processId: i.processId,
          code: moduleById[i.moduleId]?.code ?? '?',
          name: processById[i.processId]?.name ?? '',
          accent: moduleById[i.moduleId]?.accent ?? '#64748b',
          dir,
        }
      })
      .filter(Boolean) as Array<{
      key: string
      processId: string
      code: string
      name: string
      accent: string
      dir: string
    }>
  }, [stepId, active, vp, size.w, size.h])

  // 悬停时由悬停卡里的「这一步也出现在」承担，避免和卡片抢空间
  if (hover || marks.length === 0) return null

  return (
    <div className="ghost-rail" role="note">
      <div className="ghost-rail-title">同一步骤还在视口外</div>
      {marks.map((m) => (
        <button
          type="button"
          key={m.key}
          className="ghost-compass"
          data-dir={m.dir}
          style={{ ['--accent' as string]: m.accent }}
          onClick={() => goProcess(m.processId)}
          title={`跳到 ${m.code} 模块的「${m.name}」`}
        >
          <i aria-hidden>{m.dir === 'left' ? '←' : m.dir === 'right' ? '→' : m.dir === 'up' ? '↑' : '↓'}</i>
          <b>{m.code}</b>
          <span>{m.name}</span>
        </button>
      ))}
    </div>
  )
}
