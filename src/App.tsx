import { ReactFlowProvider } from '@xyflow/react'
import MapCanvas from './canvas/MapCanvas'
import Hud from './panels/Hud'
import StepHoverCard from './panels/StepHoverCard'
import ObjectDrawer from './panels/ObjectDrawer'
import CommandPalette from './panels/CommandPalette'
import GhostCompass from './panels/GhostCompass'
import { useHashRoute } from './app/hooks/useHashRoute'
import { validateContent } from './data'
import { useViewStore } from './state/viewStore'

if (import.meta.env.DEV) {
  const problems = validateContent()
  if (problems.length) console.warn('[sap-map] 内容校验发现问题：\n' + problems.join('\n'))
}

/** 必须在 ReactFlowProvider 之内：导航要用 useReactFlow */
function Shell() {
  useHashRoute()
  return (
    <>
      <MapCanvas />
      <Hud />
      <GhostCompass />
      <StepHoverCard />
      <ObjectDrawer />
      <CommandPalette />
    </>
  )
}

export default function App() {
  const lod = useViewStore((s) => s.lod)

  return (
    <div className="app" data-lod={lod}>
      <ReactFlowProvider>
        <Shell />
      </ReactFlowProvider>
    </div>
  )
}
