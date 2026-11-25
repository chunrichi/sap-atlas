/**
 * 内容自检：在构建前跑，引用断了就不出包。
 *
 * 用 Vite 自己的 SSR 加载器读 TS —— 不引入 ts-node/tsx，
 * 也不让数据文件为了「能被 Node 直接跑」而放弃 TS。
 */
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

let problems = []
try {
  const mod = await server.ssrLoadModule('/src/data/index.ts')
  problems = mod.validateContent()

  // 额外检查：主线引用的步骤必须真的存在于对应流程里
  const { endToEndFlows, beatsOf, processById, stepById } = mod
  for (const flow of endToEndFlows) {
    for (const beat of beatsOf(flow)) {
      const p = processById[beat.processId]
      const s = stepById[beat.stepId]
      if (!p) problems.push(`主线 ${flow.id} 引用了不存在的流程 ${beat.processId}`)
      else if (!s) problems.push(`主线 ${flow.id} 引用了不存在的步骤 ${beat.stepId}`)
      else if (!p.lanes.some((l) => l.stepId === beat.stepId)) {
        problems.push(`主线 ${flow.id} 把步骤 ${beat.stepId} 挂在流程 ${beat.processId} 下，但该流程没有它`)
      }
    }
  }

  // 分叉必须挂在真实存在的父线上，且分叉点是父线上的一拍
  const flowById = Object.fromEntries(endToEndFlows.map((f) => [f.id, f]))
  for (const flow of endToEndFlows) {
    if (!flow.branch) continue
    const parent = flowById[flow.branch.flowId]
    if (!parent) {
      problems.push(`分叉 ${flow.id} 指向不存在的父线 ${flow.branch.flowId}`)
    } else if (parent.branch) {
      problems.push(`分叉 ${flow.id} 挂在了另一条分叉 ${parent.id} 上，只支持一级分叉`)
    } else if (!beatsOf(parent).some((b) => b.stepId === flow.branch.atStepId)) {
      problems.push(`分叉 ${flow.id} 的分叉点 ${flow.branch.atStepId} 不在父线 ${parent.id} 上`)
    }
  }

  // 路径：抽三条代表性的链，必须走得通
  const { findPath, resolveRef } = await server.ssrLoadModule('/src/lib/path.ts')
  const cases = [
    ['pp.mrp.demand', 'fi.ar.incoming-payment'],
    ['mm.p2p.po', 'sd.o2c.billing'],
    ['sd.o2c.billing', 'sd.o2c.credit-memo'],
  ]
  for (const [a, b] of cases) {
    const from = resolveRef(a)
    const to = resolveRef(b)
    if (!from || !to) {
      problems.push(`路径用例引用了不存在的步骤：${!from ? a : b}`)
      continue
    }
    const chain = findPath(from, to)
    if (!chain) {
      problems.push(`路径不可达：${a} → ${b}`)
      continue
    }
    const bad = chain.find((n) => !stepById[n.stepId])
    if (bad) problems.push(`路径结果里有不存在的步骤 ${bad.stepId}`)
    console.log(`  · ${a} → ${b}：${chain.length - 1} 跳`)
  }
} finally {
  await server.close()
}

if (problems.length) {
  console.error(`\n✗ 内容校验失败（${problems.length} 项）`)
  for (const p of problems) console.error(`  - ${p}`)
  console.error('')
  process.exit(1)
}

console.log('✓ 内容校验通过')
