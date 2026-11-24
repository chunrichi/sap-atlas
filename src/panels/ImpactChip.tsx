import { moduleById, objectById, summarizeUsage } from '../data'
import { useViewStore } from '../state/viewStore'
import { useNavigate } from '../canvas/hooks/useNavigate'

/**
 * 影响面模式的常驻标识。
 * 它必须一直可见：否则用户看到一屏"其他都变淡了"，却不知道为什么。
 */
export default function ImpactChip() {
  const id = useViewStore((s) => s.impactObjectId)
  const clear = useViewStore((s) => s.setImpactObject)
  const selected = useViewStore((s) => s.selectedStepId)
  const focusedProcess = useViewStore((s) => s.focusedProcessId)
  const { goStep } = useNavigate()
  if (!id) return null

  const obj = objectById[id]
  if (!obj) return null
  const s = summarizeUsage(id)

  // 同一步骤可能在多条流程里出现，按「流程 + 步骤」去重后再做"下一处"
  const seen = new Set<string>()
  const places = s.list.filter((u) => {
    const key = `${u.process.id}@${u.step.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  // 同一步骤在三条流程里 id 相同，必须连流程一起判断，否则索引永远是 0
  const at = places.findIndex((u) => u.step.id === selected && u.process.id === focusedProcess)
  const next = places.length > 1 ? places[(at + 1) % places.length] : null

  return (
    <div className="impact-chip" role="status">
      <span className="impact-chip-tag">影响面</span>
      <b title={obj.techName}>{obj.techName}</b>
      <span className="impact-chip-stat">
        {s.stepCount} 步骤 · {s.processCount} 流程
      </span>
      <span className="impact-chip-mods">
        {s.moduleIds.map((mid) => {
          const m = moduleById[mid]
          return (
            <i key={mid} style={{ ['--accent' as string]: m?.accent ?? '#64748b' }}>
              {m?.code ?? mid}
            </i>
          )
        })}
      </span>
      {next && (
        <button
          type="button"
          onClick={() => goStep(next.process.id, next.step.id)}
          title={`跳到 ${next.module.code} / ${next.process.name} 的「${next.step.name}」`}
        >
          下一处 <em>{at < 0 ? 1 : at + 1}/{places.length}</em>
        </button>
      )}
      <button type="button" onClick={() => clear(null)} title="退出影响面（Esc）">
        退出 <kbd>Esc</kbd>
      </button>
    </div>
  )
}
