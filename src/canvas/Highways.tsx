import { ViewportPortal } from '@xyflow/react'
import { highways, moduleById } from '../data'
import { moduleRect, worldBounds } from './layout/layout'

type Seg = {
  x1: number
  y1: number
  x2: number
  y2: number
  lx: number
  ly: number
  label: string
}

function segments(): Seg[] {
  const out: Seg[] = []
  for (const h of highways) {
    const a = moduleRect(moduleById[h.from])
    const b = moduleRect(moduleById[h.to])
    const horizontal = Math.abs(a.y - b.y) < 10
    if (horizontal) {
      const y = a.y + a.h / 2
      const x1 = a.x + a.w + 6
      const x2 = b.x - 6
      out.push({ x1, y1: y, x2, y2: y, lx: (x1 + x2) / 2, ly: y - 26, label: h.label })
    } else {
      const x = a.x + a.w / 2
      const y1 = a.y + a.h + 6
      const y2 = b.y - 6
      out.push({ x1: x, y1, x2: x, y2, lx: x + 26, ly: (y1 + y2) / 2, label: h.label })
    }
  }
  return out
}

const SEGS = segments()
const WORLD = worldBounds()

/** 模块之间的主干「高速路」，画在世界坐标系里，随视口一起缩放 */
export default function Highways() {
  return (
    <ViewportPortal>
      <svg
        width={WORLD.w}
        height={WORLD.h}
        viewBox={`0 0 ${WORLD.w} ${WORLD.h}`}
        className="highway-layer"
        aria-hidden
      >
        {SEGS.map((s, i) => (
          <g key={i}>
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="highway-line" />
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="highway-spark" />
          </g>
        ))}
      </svg>
    </ViewportPortal>
  )
}
