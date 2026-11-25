import { beatsOf, endToEndFlows, processes, processesOfStep, stepById } from '../data'

/**
 * 路径查找建在「步骤实例」图上：
 *   节点 = 流程 × 步骤（同一步骤在两条流程里是两个节点）
 *   边   = 流程内的流向（process.edges），以及同一步骤在不同流程间的交接
 *
 * 这样「从 SD 的开票走到 FI 的收款」这种跨模块问题才能回答，
 * 而单看某条流程的边是走不出去的。
 */

export type PathRef = { processId: string; stepId: string }

/** 折叠后的路径节点：连续的同一步骤合并，记录中途经过的流程 */
export type PathNode = PathRef & { via: string[] }

const id = (processId: string, stepId: string) => `${processId}::${stepId}`

let adjacency: Map<string, string[]> | null = null

function graph(): Map<string, string[]> {
  if (adjacency) return adjacency
  const map = new Map<string, string[]>()
  const add = (from: string, to: string) => {
    const list = map.get(from)
    if (list) list.push(to)
    else map.set(from, [to])
  }

  // 1) 流程内的流向
  for (const p of processes) {
    for (const e of p.edges) {
      if (!p.lanes.some((l) => l.stepId === e.from)) continue
      add(id(p.id, e.from), id(p.id, e.to))
    }
  }

  // 2) 同一步骤在流程间的交接（可在两个方向上走）
  for (const p of processes) {
    for (const lane of p.lanes) {
      for (const q of processesOfStep[lane.stepId] ?? []) {
        if (q.id === p.id) continue
        add(id(p.id, lane.stepId), id(q.id, lane.stepId))
      }
    }
  }

  // 3) 主线上的相邻两拍：这是跨流程、跨模块的「业务交接」，
  //    比如 MRP 跑完 → 生成采购申请，图上没有这条边，但业务上它就是下一步
  for (const flow of endToEndFlows) {
    const beats = beatsOf(flow)
    for (let i = 0; i < beats.length - 1; i++) {
      const a = beats[i]
      const b = beats[i + 1]
      add(id(a.processId, a.stepId), id(b.processId, b.stepId))
    }
  }

  adjacency = map
  return map
}

export function instancesOfStep(stepId: string): PathRef[] {
  return (processesOfStep[stepId] ?? []).map((p) => ({ processId: p.id, stepId }))
}

/** 起点取用户所在的那个实例；没给就用第一个 */
export function resolveRef(stepId: string, processId?: string | null): PathRef | null {
  if (!stepById[stepId]) return null
  const list = instancesOfStep(stepId)
  if (list.length === 0) return null
  if (processId && list.some((x) => x.processId === processId)) {
    return { processId, stepId }
  }
  return list[0]
}

/** BFS：无权图，边数最少的一条就是「最直接」的走法 */
export function findPath(from: PathRef, to: PathRef): PathNode[] | null {
  if (from.stepId === to.stepId) return [{ ...from, via: [] }]

  const start = id(from.processId, from.stepId)
  const goals = new Set(instancesOfStep(to.stepId).map((x) => id(x.processId, x.stepId)))
  if (goals.size === 0) return null

  const adj = graph()
  const prev = new Map<string, string | null>([[start, null]])
  const queue: string[] = [start]

  let found: string | null = goals.has(start) ? start : null

  while (queue.length > 0 && !found) {
    const cur = queue.shift()!
    for (const next of adj.get(cur) ?? []) {
      if (prev.has(next)) continue
      prev.set(next, cur)
      if (goals.has(next)) {
        found = next
        break
      }
      queue.push(next)
    }
  }

  if (!found) return null

  const raw: string[] = []
  for (let cur: string | null = found; cur; cur = prev.get(cur) ?? null) raw.push(cur)
  raw.reverse()

  // 折叠连续的同一步骤：同一步骤在两条流程里出现时，内容是一样的，
  // 展开成两个 chip 只会让人以为中间还有一步
  const out: PathNode[] = []
  for (const node of raw) {
    const [processId, stepId] = node.split('::')
    const last = out[out.length - 1]
    if (last && last.stepId === stepId) {
      last.via.push(processId)
      continue
    }
    out.push({ processId, stepId, via: [] })
  }
  return out
}
