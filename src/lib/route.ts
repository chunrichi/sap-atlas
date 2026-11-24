import { moduleById, processById, stepById } from '../data'
import type { ModuleId } from '../data/types'

export type Route =
  | { kind: 'home' }
  | { kind: 'module'; moduleId: ModuleId }
  | { kind: 'process'; processId: string }
  | { kind: 'step'; processId: string; stepId: string }

/**
 * 用 hash 路由，不用 history 路由：GitHub Pages 是静态托管，
 * 刷新子路径会 404，而 hash 永远不会打到服务器。
 */
export function parseHash(raw: string): Route {
  const parts = raw.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'm' && parts[1] && moduleById[parts[1] as ModuleId]) {
    return { kind: 'module', moduleId: parts[1] as ModuleId }
  }
  if (parts[0] === 'p' && parts[1] && processById[parts[1]]) {
    return { kind: 'process', processId: parts[1] }
  }
  if (parts[0] === 's' && parts[1] && parts[2] && processById[parts[1]] && stepById[parts[2]]) {
    return { kind: 'step', processId: parts[1], stepId: parts[2] }
  }
  return { kind: 'home' }
}

export function toHash(route: Route): string {
  switch (route.kind) {
    case 'module':
      return `#/m/${route.moduleId}`
    case 'process':
      return `#/p/${route.processId}`
    case 'step':
      return `#/s/${route.processId}/${route.stepId}`
    default:
      return '#/'
  }
}

/**
 * 由导航动作直接写 hash —— 不从 store 反推。
 * 从 store 反推会踩到「首帧 store 还是空的」和 StrictMode 双跑 effect，
 * 结果是深链刚打开就被写回 #/。
 *
 * mode='push' 时产生历史记录，浏览器后退才能逐级返回；
 * 从 hash/popstate 恢复视图时必须用 'replace'，否则会自己push自己。
 */
export function writeHash(route: Route, mode: 'replace' | 'push' = 'replace') {
  const h = toHash(route)
  if (window.location.hash === h) return
  if (mode === 'push') window.history.pushState(null, '', h)
  else window.history.replaceState(null, '', h)
}
