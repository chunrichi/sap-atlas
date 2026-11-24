import type { Edge, Node } from '@xyflow/react'
import type { ModuleId, Process, SapModule, Step } from '../data/types'
import { moduleById, modules, processes, processesByModule, processesOfStep, stepById } from '../data'
import {
  laneRect,
  maxRowOf,
  moduleRect,
  stepRect,
  stepYBase,
} from '../canvas/layout/layout'

export type ModuleNodeData = {
  module: SapModule
  processCount: number
  stepCount: number
}

export type LaneNodeData = {
  process: Process
  module: SapModule
  stepCount: number
}

export type StepNodeData = {
  step: Step
  process: Process
  module: SapModule
  order: number
  objectCount: number
  alsoIn: string[]
  maxRow: number
}

export type ModuleNode = Node<ModuleNodeData, 'module'>
export type LaneNode = Node<LaneNodeData, 'lane'>
export type StepFlowNode = Node<StepNodeData, 'step'>
export type AnyNode = ModuleNode | LaneNode | StepFlowNode

const moduleStepCount = (m: SapModule) => {
  const ids = new Set<string>()
  for (const p of processesByModule[m.id] ?? []) for (const l of p.lanes) ids.add(l.stepId)
  return ids.size
}

export function buildNodes(): AnyNode[] {
  const nodes: AnyNode[] = []

  for (const m of modules) {
    const rect = moduleRect(m)
    const ps = processesByModule[m.id] ?? []
    nodes.push({
      id: `m:${m.id}`,
      type: 'module',
      position: { x: rect.x, y: rect.y },
      data: { module: m, processCount: ps.length, stepCount: moduleStepCount(m) },
      draggable: false,
      selectable: false,
      zIndex: 0,
    })

    ps.forEach((p, laneIdx) => {
      const lane = laneRect(m, laneIdx)
      nodes.push({
        id: `l:${p.id}`,
        type: 'lane',
        position: { x: lane.x, y: lane.y },
        data: { process: p, module: m, stepCount: p.lanes.length },
        draggable: false,
        selectable: false,
        zIndex: 1,
      })

      const maxRow = maxRowOf(p)
      const yBase = stepYBase(maxRow)
      const sorted = [...p.lanes].sort((a, b) => a.col - b.col || a.row - b.row)

      sorted.forEach((placement, idx) => {
        const step = stepById[placement.stepId]
        if (!step) return
        const r = stepRect(lane, placement.col, placement.row, yBase)
        const alsoIn = (processesOfStep[step.id] ?? [])
          .filter((x) => x.id !== p.id)
          .map((x) => `${moduleById[x.moduleId]?.code ?? ''} · ${x.name}`)
        nodes.push({
          id: `s:${p.id}::${step.id}`,
          type: 'step',
          position: { x: r.x, y: r.y },
          data: {
            step,
            process: p,
            module: m,
            order: idx + 1,
            objectCount: step.objectIds.length,
            alsoIn,
            maxRow,
          },
          draggable: false,
          selectable: false,
          zIndex: 2,
        })
      })
    })
  }

  return nodes
}

export function buildEdges(): Edge[] {
  const edges: Edge[] = []

  for (const p of processes) {
    for (const e of p.edges) {
      edges.push({
        id: `e:${p.id}:${e.from}->${e.to}`,
        source: `s:${p.id}::${e.from}`,
        target: `s:${p.id}::${e.to}`,
        type: 'flow',
        data: { kind: e.kind ?? 'flow', moduleId: p.moduleId },
        zIndex: 3,
      })
    }
  }

  return edges
}
