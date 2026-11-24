import { useEffect, useRef } from 'react'
import { useNavigate } from '../../canvas/hooks/useNavigate'
import { parseHash } from '../../lib/route'

/**
 * 单向：hash → 视图。
 * 视图 → hash 由 useNavigate 里的 writeHash 负责，避免从 store 反推带来的时序问题。
 */
export function useHashRoute() {
  const nav = useNavigate()
  const latest = useRef(nav)
  latest.current = nav

  useEffect(() => {
    const apply = () => {
      const r = parseHash(window.location.hash)
      const n = latest.current
      if (r.kind === 'module') n.goModule(r.moduleId)
      else if (r.kind === 'process') n.goProcess(r.processId)
      else if (r.kind === 'step') n.goStep(r.processId, r.stepId)
      else n.goHome()
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])
}
