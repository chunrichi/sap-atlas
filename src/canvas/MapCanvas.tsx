import { useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { buildEdges, buildNodes } from '../graph/buildGraph'
import ModuleNode from '../nodes/ModuleNode'
import LaneNode from '../nodes/LaneNode'
import StepNode from '../nodes/StepNode'
import FlowEdge from './edges/FlowEdge'
import Highways from './Highways'
import GhostLinks from './GhostLinks'
import { useViewStore } from '../state/viewStore'
import { lodFromZoom } from './lod/lod.config'
import { homeViewport } from './layout/layout'

const nodeTypes = { module: ModuleNode, lane: LaneNode, step: StepNode }

// 必须是稳定引用：每次渲染新建对象会让 React Flow 反复套用初始视口
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 0.14 }
const edgeTypes = { flow: FlowEdge }

function miniMapColor(n: Node): string {
  const d = n.data as { module?: { accent: string } }
  if (n.type === 'module') return `${d.module?.accent ?? '#94a3b8'}26`
  if (n.type === 'step') return d.module?.accent ?? '#94a3b8'
  return 'transparent'
}

export default function MapCanvas() {
  const nodes = useMemo(buildNodes, [])
  const edges = useMemo(buildEdges, [])
  const { zoom } = useViewport()
  const lod = useViewStore((s) => s.lod)
  const setLod = useViewStore((s) => s.setLod)
  const setSize = useViewStore((s) => s.setSize)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rf = useReactFlow()

  useEffect(() => {
    setLod(lodFromZoom(zoom))
  }, [zoom, setLod])

  // 稳定停在 L0 才解除聚焦：否则「飞入模块」动画开头的那几帧会把焦点清掉
  useEffect(() => {
    if (lod !== 0) return
    const t = window.setTimeout(() => {
      const st = useViewStore.getState()
      if (st.lod !== 0) return
      if (Date.now() < st.navUntil) return
      st.clearFocus()
    }, 560)
    return () => window.clearTimeout(t)
  }, [lod])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return
      setSize(r.width, r.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [rf, setSize])

  return (
    <div className="canvas-wrap" data-lod={lod} ref={wrapRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={DEFAULT_VIEWPORT}
        minZoom={0.07}
        maxZoom={1.9}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        preventScrolling
        onlyRenderVisibleElements={false}
        className="sap-flow"
        onInit={() => {
          const el = wrapRef.current
          if (!el) return
          const r = el.getBoundingClientRect()
          if (r.width < 2) return
          void rf.setViewport(homeViewport(r.width, r.height))
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={60}
          size={2}
          color="rgba(16,24,40,0.11)"
          bgColor="transparent"
        />
        <Highways />
        <GhostLinks />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          position="top-right"
          pannable
          zoomable
          maskColor="rgba(244,245,247,0.74)"
          nodeStrokeWidth={0}
          nodeColor={miniMapColor}
          style={{ width: 172, height: 104 }}
        />
      </ReactFlow>
    </div>
  )
}
