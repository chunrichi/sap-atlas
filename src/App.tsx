import { ReactFlowProvider } from '@xyflow/react'
import MapCanvas from './canvas/MapCanvas'
import Hud from './panels/Hud'
import StepHoverCard from './panels/StepHoverCard'
import ObjectDrawer from './panels/ObjectDrawer'
import { validateContent } from './data'
import { useViewStore } from './state/viewStore'

if (import.meta.env.DEV) {
  const problems = validateContent()
  if (problems.length) console.warn('[sap-map] 内容校验发现问题：\n' + problems.join('\n'))
}

export default function App() {
  const lod = useViewStore((s) => s.lod)

  return (
    <div className="app" data-lod={lod}>
      <ReactFlowProvider>
        <MapCanvas />
        <Hud />
        <StepHoverCard />
        <ObjectDrawer />
      </ReactFlowProvider>
    </div>
  )
}
