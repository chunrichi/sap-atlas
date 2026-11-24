import { useViewStore } from '../state/viewStore'
import { OBJECT_TYPE_LABEL, type DevObject, type ObjectType } from '../data/types'
import { objectById, processById, processesOfStep, stepById, stepOrderIn } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'

const TYPE_ORDER: ObjectType[] = [
  'bapi',
  'fm',
  'badi',
  'userexit',
  'enhancement',
  'table',
  'cds',
  'odata',
  'idoc',
]

function groupObjects(objects: DevObject[]) {
  const groups = new Map<ObjectType, DevObject[]>()
  for (const o of objects) {
    const list = groups.get(o.type) ?? []
    list.push(o)
    groups.set(o.type, list)
  }
  return TYPE_ORDER.filter((t) => groups.has(t)).map((t) => ({ type: t, items: groups.get(t)! }))
}

export default function StepHoverCard() {
  const hover = useViewStore((s) => s.hover)
  const objectId = useViewStore((s) => s.objectId)
  const keepHover = useViewStore((s) => s.keepHover)
  const hideNow = useViewStore((s) => s.hideNow)
  const openObject = useViewStore((s) => s.openObject)
  const { goProcess } = useNavigate()

  if (!hover || objectId) return null

  const step = stepById[hover.stepId]
  const process = processById[hover.processId]
  if (!step || !process) return null

  const objects = step.objectIds.map((id) => objectById[id]).filter(Boolean)
  const groups = groupObjects(objects)
  const others = (processesOfStep[step.id] ?? []).filter((p) => p.id !== process.id)
  const order = stepOrderIn(hover.processId, step.id)

  const W = 358
  const H = Math.min(window.innerHeight * 0.74, 520)
  const left = Math.max(12, Math.min(hover.x + 16, window.innerWidth - W - 16))
  const top = Math.max(14, Math.min(hover.y - 12, window.innerHeight - H - 16))

  return (
    <div
      className="hover-card"
      style={{ left, top, width: W, maxHeight: H }}
      onMouseEnter={keepHover}
      onMouseLeave={hideNow}
    >
      <div className="hc-head">
        <span className="hc-order">{String(order).padStart(2, '0')}</span>
        <div className="hc-title-wrap">
          <div className="hc-title">{step.name}</div>
          <div className="hc-sub">
            {process.name}
            {step.tcode ? ` · ${step.tcode}` : ''}
          </div>
        </div>
      </div>

      <div className="hc-facts">
        {step.tcode && (
          <div className="hc-fact">
            <span>事务码</span>
            <b>{step.tcode}</b>
          </div>
        )}
        <div className="hc-fact">
          <span>角色</span>
          <b>{step.role}</b>
        </div>
        {step.output && (
          <div className="hc-fact wide">
            <span>产出</span>
            <b>{step.output}</b>
          </div>
        )}
      </div>

      <p className="hc-intent">{step.intent}</p>

      <div className="hc-sec">
        <div className="hc-sec-title">
          开发对象
          <span className="hc-sec-count">{objects.length}</span>
        </div>
        <div className="hc-objs">
          {groups.map((g) => (
            <div className="hc-group" key={g.type}>
              <span className="hc-group-label">{OBJECT_TYPE_LABEL[g.type]}</span>
              <div className="hc-group-items">
                {g.items.map((o) => (
                  <button
                    type="button"
                    key={o.id}
                    className="obj-pill"
                    onClick={() => openObject(o.id)}
                  >
                    <span className="obj-pill-name">{o.techName}</span>
                    <span className="obj-pill-title">{o.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {others.length > 0 && (
        <div className="hc-sec">
          <div className="hc-sec-title">这一步也出现在</div>
          <div className="hc-links">
            {others.map((p) => (
              <button
                type="button"
                key={p.id}
                className="link-chip"
                onClick={() => goProcess(p.id)}
              >
                ↗ {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {step.note && <div className="hc-note">{step.note}</div>}

      <div className="hc-foot">点击开发对象查看参数与示例代码</div>
    </div>
  )
}
