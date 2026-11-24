import type { DevObject, ModuleId, Process, Step, StepKind } from './types'
import { modules, moduleById, highways } from './modules'
import { processes } from './processes'
import { sdSteps, fiSteps, pricingSteps, creditSteps } from './steps'
import { mmSteps, fiApSteps } from './steps/mm'
import { ppSteps } from './steps/pp'
import { wmSteps } from './steps/wm'
import { coSteps } from './steps/co'
import { abapApiObjects } from './objects/abap-api'
import { enhancementObjects } from './objects/enhancement'
import { dataModelObjects } from './objects/data-model'
import { integrationObjects } from './objects/integration'
import { mmObjects } from './objects/mm'
import { ppObjects } from './objects/pp'
import { wmObjects } from './objects/wm'
import { coObjects } from './objects/co'
import { snippets, snippetById } from './snippets'
import { endToEndFlows, beatsOf, flowById } from './flows'

export { modules, moduleById, highways, processes, snippets, snippetById }
export { endToEndFlows, beatsOf, flowById }
export * from './types'

export const allSteps: Step[] = [
  ...sdSteps,
  ...mmSteps,
  ...ppSteps,
  ...wmSteps,
  ...coSteps,
  ...fiSteps,
  ...fiApSteps,
  ...pricingSteps,
  ...creditSteps,
]

export const allObjects: DevObject[] = [
  ...abapApiObjects,
  ...enhancementObjects,
  ...dataModelObjects,
  ...integrationObjects,
  ...mmObjects,
  ...ppObjects,
  ...wmObjects,
  ...coObjects,
]

export const stepById = Object.fromEntries(allSteps.map((s) => [s.id, s])) as Record<string, Step>
export const objectById = Object.fromEntries(allObjects.map((o) => [o.id, o])) as Record<
  string,
  DevObject
>
export const processById = Object.fromEntries(processes.map((p) => [p.id, p])) as Record<
  string,
  Process
>

/** 模块 → 流程（顺序即泳道顺序） */
export const processesByModule = modules.reduce(
  (acc, m) => {
    acc[m.id] = processes.filter((p) => p.moduleId === m.id)
    return acc
  },
  {} as Record<ModuleId, Process[]>,
)

/** 步骤 id → 它出现在哪些流程里（网状索引的核心） */
export const processesOfStep: Record<string, Process[]> = (() => {
  const map: Record<string, Process[]> = {}
  for (const p of processes) {
    for (const lane of p.lanes) {
      ;(map[lane.stepId] ||= []).push(p)
    }
  }
  return map
})()

/** 某流程的步骤，按列排序，用于编号 */
export function stepsOfProcess(process: Process): Array<{ step: Step; col: number; index: number }> {
  return [...process.lanes]
    .sort((a, b) => a.col - b.col || a.row - b.row)
    .map((lane, i) => ({ step: stepById[lane.stepId], col: lane.col, index: i + 1 }))
    .filter((x) => Boolean(x.step))
}

/** 步骤序号（① ② ③），跨流程时按该流程内的顺序 */
export function stepOrderIn(processId: string, stepId: string): number {
  const p = processById[processId]
  if (!p) return 0
  const sorted = [...p.lanes].sort((a, b) => a.col - b.col || a.row - b.row)
  return sorted.findIndex((l) => l.stepId === stepId) + 1
}

export function objectsOfStep(stepId: string): DevObject[] {
  const step = stepById[stepId]
  if (!step) return []
  return step.objectIds.map((id) => objectById[id]).filter(Boolean)
}

export const KIND_LABEL: Record<StepKind, string> = {
  human: '人工操作',
  system: '系统自动',
  document: '单据产出',
}

/** 开发期自检：引用缺失时在控制台明确报出来，避免静默空白 */
export function validateContent(): string[] {
  const problems: string[] = []
  const seenStep = new Set<string>()
  for (const s of allSteps) {
    if (seenStep.has(s.id)) problems.push(`步骤 id 重复：${s.id}`)
    seenStep.add(s.id)
    for (const oid of s.objectIds) {
      if (!objectById[oid]) problems.push(`步骤 ${s.id} 引用了不存在的对象 ${oid}`)
    }
  }
  const seenObj = new Set<string>()
  for (const o of allObjects) {
    if (seenObj.has(o.id)) problems.push(`对象 id 重复：${o.id}`)
    seenObj.add(o.id)
    if (o.snippetId && !snippetById[o.snippetId]) {
      problems.push(`对象 ${o.id} 引用了不存在的代码 ${o.snippetId}`)
    }
    if (!o.snippetId && !o.docs?.length) {
      problems.push(`对象 ${o.id} 既没有示例代码也没有官方文档链接`)
    }
  }
  for (const p of processes) {
    for (const lane of p.lanes) {
      if (!stepById[lane.stepId]) problems.push(`流程 ${p.id} 引用了不存在的步骤 ${lane.stepId}`)
    }
  }
  return problems
}
