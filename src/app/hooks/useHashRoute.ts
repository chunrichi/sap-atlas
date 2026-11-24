import { useEffect, useRef } from 'react'
import { useNavigate } from '../../canvas/hooks/useNavigate'
import { parseHash } from '../../lib/route'

/**
 * 单向：hash / 浏览器历史 → 视图。
 * 视图 → hash 由 useNavigate 里的 writeHash 负责，避免从 store 反推带来的时序问题。
 *
 * 恢复视图时必须传 { history: false }：否则后退一次会再 push 一条，永远退不出去。
 */
export function useHashRoute() {
  const nav = useNavigate()
  const latest = useRef(nav)
  latest.current = nav

  useEffect(() => {
    // 后退时 popstate 与 hashchange 都会来，用时间戳去重，只应用一次
    let lastPopAt = 0

    const apply = () => {
      const r = parseHash(window.location.hash)
      const n = latest.current
      const opts = { history: false }
      if (r.kind === 'module') n.goModule(r.moduleId, opts)
      else if (r.kind === 'process') n.goProcess(r.processId, opts)
      else if (r.kind === 'step') n.goStep(r.processId, r.stepId, opts)
      else n.goHome(opts)
    }

    const onPop = () => {
      lastPopAt = Date.now()
      apply()
    }
    const onHash = () => {
      if (Date.now() - lastPopAt < 80) return
      apply()
    }

    apply()
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])
}
