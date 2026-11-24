import type { Step } from '../types'

/**
 * CO 模块步骤：只做「产品成本 → 差异 → 毛利」这条线。
 * 与 PP 的交汇点：订单结算（KO88）既是生产的收尾，也是产品成本的一环。
 */
export const coSteps: Step[] = [
  {
    id: 'co.pc.estimate',
    name: '标准成本估算',
    kind: 'human',
    tcode: 'CK11N',
    role: '成本会计',
    input: 'BOM + 工艺路线 + 物料价格 + 作业价格',
    output: '成本估算（KEKO/KEPH），含料工费明细',
    intent:
      '按 BOM 逐层滚算：每个组件的标准价 × 用量，加上工艺路线的工时 × 作业价格，得到「这个产品理论上应该花多少钱」。它同时是库存计价与差异分析的基准。',
    objectIds: ['table.KEKO', 'table.KEPH', 'bapi.COSTESTIMATE_GETLIST'],
    note: '估算出来的成本对不上，九成是 BOM 用量或作业价格没维护；先拆开看料、工、费三段，再往下查。',
  },
  {
    id: 'co.pc.release',
    name: '标记与发布标准成本',
    kind: 'human',
    tcode: 'CK24',
    role: '成本会计',
    input: '已估算的成本',
    output: '物料标准价更新（MBEW）',
    intent:
      '标记（Mark）只是备选，发布（Release）才真正写进物料主数据的标准价，并从下一期间生效。发布之后，所有出入库都按新价记账 —— 这是一个不可轻率的动作。',
    objectIds: ['table.MBEW', 'table.KEKO'],
    note: '发布错了要用 CKMPRP 冲销，不能直接改 MBEW 的字段；直接改会破坏期间的账实一致。',
  },
  {
    id: 'co.pc.variance',
    name: '生产差异分析',
    kind: 'document',
    tcode: 'KKS1 / KKS2',
    role: '成本会计',
    input: '订单的投入（发料、报工）与产出（入库）',
    output: '差异分类：价格 / 用量 / 效率 / 批量',
    intent:
      '把「实际花的」与「标准该花的」差额拆成可行动的原因：料价涨了、用量超了、工时多了，还是批量太小。差异不分清，成本改善就无从下手。',
    objectIds: ['table.COSP', 'table.COEP', 'table.KEKO'],
    note: '差异为 0 不代表没问题：可能是订单还没收货，或标准价刚好等于实际，先确认订单状态。',
  },
  {
    id: 'co.pc.copa',
    name: '获利分析',
    kind: 'document',
    tcode: 'KE30',
    fiori: 'Profitability Analysis',
    role: '管理会计 / 销售分析',
    input: '开票收入 + 销售成本 + 差异',
    output: '按客户/产品/区域的毛利报表',
    intent:
      '把收入和成本按维度（客户、产品、区域、渠道）对齐，回答「哪些生意真的赚钱」。这里是销售、生产、财务三条线的汇合点 —— 也是这套知识图谱的终点。',
    objectIds: ['table.CE1', 'table.COSP'],
    note: 'COPA 的数值对不上，先查「成本估算是否发布」与「开票是否已过账」，这两处最容易断链。',
  },
]
