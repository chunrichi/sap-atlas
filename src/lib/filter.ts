import type { ModuleId, Step, StepKind } from '../data/types'
import { objectById } from '../data'

/**
 * 筛选不是「隐藏」，而是「压暗 + 计数」：
 * 隐藏会让图的空间结构塌陷，用户会失去「东西大概在哪儿」的记忆。
 */
export type FilterState = {
  /** 空数组 = 不限类型 */
  kinds: StepKind[]
  moduleId: ModuleId | null
  /** 只看挂了 BAdI / 增强的步骤：开发最常问的一句话 */
  onlyBadi: boolean
}

export const EMPTY_FILTER: FilterState = { kinds: [], moduleId: null, onlyBadi: false }

export function filterActive(f: FilterState): boolean {
  return f.kinds.length > 0 || Boolean(f.moduleId) || f.onlyBadi
}

const BADI_LIKE = new Set(['badi', 'userexit', 'enhancement'])

export function stepMatches(step: Step, instanceModuleId: ModuleId, f: FilterState): boolean {
  if (f.kinds.length > 0 && !f.kinds.includes(step.kind)) return false
  if (f.moduleId && f.moduleId !== instanceModuleId) return false
  if (f.onlyBadi && !step.objectIds.some((id) => BADI_LIKE.has(objectById[id]?.type ?? ''))) {
    return false
  }
  return true
}
