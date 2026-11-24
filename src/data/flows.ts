/**
 * 端到端主线：跨模块的价值链。
 *
 * 它不新增步骤内容，只引用已有的 `stepId` + `processId` ——
 * 这样「主线」永远和画布上的节点是同一份事实，不会两处维护。
 */
export type FlowBeat = {
  stepId: string
  /** 这条主线里该步骤落在哪个流程（同一步骤可能在多个流程里） */
  processId: string
  /** 交接说明：上一环节给下一环节留下了什么 */
  note?: string
}

export type FlowPhase = {
  id: string
  name: string
  beats: FlowBeat[]
}

export type EndToEndFlow = {
  id: string
  name: string
  goal: string
  /** 途经模块，用于头部说明 */
  modules: string
  phases: FlowPhase[]
}

export const endToEndFlows: EndToEndFlow[] = [
  {
    id: 'flow.p2c',
    name: '计划到收款',
    goal: '从一份预测开始，经过采购、生产、销售、交付，最后变成银行账户里的钱。',
    modules: 'PP → MM → PP → SD → FI',
    phases: [
      {
        id: 'plan',
        name: '需求与采购',
        beats: [
          { stepId: 'pp.mrp.demand', processId: 'pp.mrp', note: '预测进入系统，成为 MRP 的输入' },
          { stepId: 'pp.mrp.run', processId: 'pp.mrp', note: '倒推：缺什么、缺多少、什么时候到' },
          { stepId: 'mm.p2p.requisition', processId: 'mm.p2p', note: '外购件生成采购申请（MRP 的产物）' },
          { stepId: 'mm.p2p.po', processId: 'mm.p2p', note: '请购转订单，对供应商形成承诺' },
          { stepId: 'mm.p2p.goods-receipt', processId: 'mm.p2p', note: '到货入库，库存可供生产领用' },
        ],
      },
      {
        id: 'make',
        name: '生产',
        beats: [
          { stepId: 'pp.prod.order', processId: 'pp.production', note: '计划订单转生产订单，成本对象确定' },
          { stepId: 'pp.prod.issue', processId: 'pp.production', note: '按订单发料，成本进入 WIP' },
          { stepId: 'pp.prod.confirm', processId: 'pp.production', note: '报工：工时与产出变成成本与产能数据' },
          { stepId: 'pp.prod.receipt', processId: 'pp.production', note: '成品入库，可供销售发货' },
        ],
      },
      {
        id: 'sell',
        name: '销售与交付',
        beats: [
          { stepId: 'sd.o2c.create-order', processId: 'sd.o2c', note: '订单占库存、定价、触发信用检查' },
          { stepId: 'sd.o2c.delivery', processId: 'sd.o2c', note: '订单行变成实际要出的货' },
          { stepId: 'sd.o2c.goods-issue', processId: 'sd.o2c', note: '发货过账：库存减少，成本转 COGS' },
          { stepId: 'sd.o2c.billing', processId: 'sd.o2c', note: '按实发数量开票，产生收入' },
        ],
      },
      {
        id: 'cash',
        name: '财务',
        beats: [
          { stepId: 'sd.o2c.billing-post', processId: 'sd.o2c', note: '开票即入账：借应收、贷收入' },
          { stepId: 'fi.ar.incoming-payment', processId: 'fi.ar', note: '收到钱，清账，闭环' },
        ],
      },
    ],
  },
  {
    id: 'flow.returns',
    name: '退货闭环',
    goal: '主线不是永远向前：货卖出去又回来时，账要能退回去，而且不留尾巴。',
    modules: 'SD → FI',
    phases: [
      {
        id: 'trigger',
        name: '触发',
        beats: [
          { stepId: 'sd.o2c.billing', processId: 'sd.o2c', note: '原发票是退货的依据：退哪张、退多少' },
        ],
      },
      {
        id: 'reverse',
        name: '退货与冲减',
        beats: [
          { stepId: 'sd.o2c.return', processId: 'sd.o2c', note: '退货订单 + 退货收货，库存回补' },
          { stepId: 'sd.o2c.credit-memo', processId: 'sd.o2c', note: '贷项凭证冲减应收与收入' },
        ],
      },
      {
        id: 'settle',
        name: '财务收尾',
        beats: [
          { stepId: 'sd.o2c.billing-post', processId: 'sd.o2c', note: '贷项凭证过账：借贷方向与原发票相反' },
          { stepId: 'fi.ar.aging', processId: 'fi.ar', note: '应收回到干净余额，账龄重算' },
        ],
      },
    ],
  },
]

export const flowById = Object.fromEntries(endToEndFlows.map((f) => [f.id, f]))

/** 摊平成一维，用于「上一步 / 下一步」与进度 */
export function beatsOf(flow: EndToEndFlow): FlowBeat[] {
  return flow.phases.flatMap((p) => p.beats)
}
