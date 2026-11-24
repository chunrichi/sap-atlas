import { useViewStore } from '../state/viewStore'
import { OBJECT_TYPE_LABEL, type DevObject, type ObjectType } from '../data/types'
import { moduleById, objectById, processById, processesOfStep, stepById, stepOrderIn } from '../data'
import { useNavigate } from '../canvas/hooks/useNavigate'
import { cx } from '../lib/cx'

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
  const coarse = useViewStore((s) => s.coarse)
  const { goProcess, goStep } = useNavigate()

  if (!hover || objectId) return null

  const step = stepById[hover.stepId]
  const process = processById[hover.processId]
  if (!step || !process) return null

  const objects = step.objectIds.map((id) => objectById[id]).filter(Boolean)
  // 悬停卡只做「预览」：最多 6 个，其余留给抽屉
  const LIMIT = 5
  const groups = groupObjects(objects.slice(0, LIMIT))
  const rest = objects.length - LIMIT
  const others = (processesOfStep[step.id] ?? []).filter((p) => p.id !== process.id)
  const order = stepOrderIn(hover.processId, step.id)

  const W = 358
  const H = Math.min(window.innerHeight * 0.78, 600)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const GAP = 14
  const rightLeft = hover.x + GAP
  const leftLeft = hover.x - hover.w - GAP - W

  // 默认贴右侧；右边放不下就翻到左侧；两侧都放不下才退到上/下方，
  // 任何情况下都不让浮层压住正在悬停的那张卡。
  let side: 'right' | 'left' | 'below' | 'above'
  let left: number
  let top: number
  if (rightLeft + W <= vw - 12) {
    side = 'right'
    left = rightLeft
  } else if (leftLeft >= 12) {
    side = 'left'
    left = leftLeft
  } else {
    left = Math.max(12, Math.min(hover.x - hover.w / 2 - W / 2, vw - W - 12))
    side = hover.y + hover.h + GAP + 120 < vh ? 'below' : 'above'
  }

  if (side === 'below') {
    top = hover.y + hover.h + GAP
  } else if (side === 'above') {
    top = Math.max(14, hover.y - H - GAP)
  } else {
    top = Math.max(14, Math.min(hover.y - 10, vh - H - 16))
  }

  return (
    <div
      className={cx('hover-card', coarse && 'is-sheet')}
      data-side={side}
      style={{ left, top, width: W, maxHeight: H }}
      onMouseEnter={keepHover}
      onMouseLeave={hideNow}
    >
      {coarse && <span className="hc-grab" aria-hidden />}
      <div className="hc-head">
        <span className="hc-order">{String(order).padStart(2, '0')}</span>
        <div className="hc-title-wrap">
          <div className="hc-title">{step.name}</div>
          <div className="hc-sub">
            {process.name}
            {step.tcode ? ` · ${step.tcode}` : ''}
          </div>
        </div>
        {coarse && (
          <button type="button" className="hc-close" onClick={hideNow} aria-label="收起">
            ×
          </button>
        )}
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
        {rest > 0 && <div className="hc-more">另有 {rest} 个开发对象，点击上方任一项在抽屉里查看</div>}
      </div>

      {others.length > 0 && (
        <div className="hc-sec">
          <div className="hc-sec-title">这一步也出现在</div>
          <div className="hc-links">
            {others.map((p) => {
              const om = moduleById[p.moduleId]
              const cross = p.moduleId !== process.moduleId
              return (
                <button
                  type="button"
                  key={p.id}
                  className={cx('link-chip', cross && 'is-cross')}
                  onClick={() => goProcess(p.id)}
                  title={cross ? `跨模块到 ${om.code} 模块` : '同模块内的另一条流程'}
                >
                  {cross && <b>{om.code}</b>} ↗ {p.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {step.note && <div className="hc-note">{step.note}</div>}

      <div className="hc-foot">
        {coarse ? (
          // 抽屉会盖住刚点的那张卡，"再点一次"不可达，所以给一个明确入口
          <button
            type="button"
            className="hc-enter"
            onClick={() => {
              hideNow()
              goStep(process.id, step.id)
            }}
          >
            进入这一步 <span aria-hidden>→</span>
          </button>
        ) : (
          '点击开发对象查看参数与示例代码'
        )}
      </div>
    </div>
  )
}
