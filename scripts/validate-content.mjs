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
