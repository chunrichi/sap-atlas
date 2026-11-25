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
import { modules } from '../data'
import ModuleNode from '../nodes/ModuleNode'
import LaneNode from '../nodes/LaneNode'
import StepNode from '../nodes/StepNode'
import FlowEdge from './edges/FlowEdge'
import Highways from './Highways'
import GhostLinks from './GhostLinks'
import { useViewStore } from '../state/viewStore'
import { lodFromZoom } from './lod/lod.config'
import { homeViewport, moduleRect } from './layout/layout'

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
  const setOffGrid = useViewStore((s) => s.setOffGrid)
  const hideNow = useViewStore((s) => s.hideNow)
  const selectStep = useViewStore((s) => s.selectStep)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rf = useReactFlow()

  /** 视口与任一模块都不相交 = 眼前没有任何内容 */
  const checkOffGrid = (vp: { x: number; y: number; zoom: number }) => {
    const r = wrapRef.current?.getBoundingClientRect()
    const vw = r?.width ?? 0
    const vh = r?.height ?? 0
    if (vw < 2 || vh < 2) return
    const x0 = -vp.x / vp.zoom
    const y0 = -vp.y / vp.zoom
    const x1 = x0 + vw / vp.zoom
    const y1 = y0 + vh / vp.zoom
    const M = 80 // 只露一条边也还算「看得到」，别过早弹提示
    const hit = modules.some((m) => {
      const b = moduleRect(m)
      return b.x + b.w > x0 + M && b.x < x1 - M && b.y + b.h > y0 + M && b.y < y1 - M
    })
    setOffGrid(!hit)
  }

  useEffect(() => {
    setLod(lodFromZoom(zoom))
  }, [zoom, setLod])

  /**
   * 文本比图形更需要「最小屏幕字号」：
   * 卡片在世界上是固定尺寸，缩小时字号会跟着缩成 6px。
   * 把 1/zoom 写进 CSS 变量，样式里用 max(设计值, 最小屏幕值 * --inv) 反算，
   * 让文字在低倍率下保持可读，又不会在高倍率下被放大。
   * 只在变化超过 4% 时写入，避免缩放过程中每帧重算整棵子树样式。
   */
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const inv = Math.min(3.4, 1 / Math.max(zoom, 0.2))
    const last = parseFloat(el.style.getPropertyValue('--inv')) || 0
    if (last && Math.abs(inv - last) / last < 0.04) return
    el.style.setProperty('--inv', inv.toFixed(3))
  }, [zoom])

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
        onMoveEnd={(_, vp) => checkOffGrid(vp)}
        // 点空白处 = 收起悬停卡、取消选中（触屏上这是唯一的"退出"手势）
        onPaneClick={() => {
          hideNow()
          selectStep(null)
        }}
        onInit={() => {
          const el = wrapRef.current
          if (!el) return
          const r = el.getBoundingClientRect()
          if (r.width < 2) return
          const vp = homeViewport(r.width, r.height)
          void rf.setViewport(vp)
          checkOffGrid(vp)
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
