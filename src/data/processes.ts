import type { Process } from './types'

/**
 * 布局是手工声明的（col / row），不是自动算的。
 * 原因：用户靠空间记忆找东西，位置一旦抖动就迷路。
 *
 * 跨模块共用的步骤直接引用同一个 stepId —— 这是「网状」的唯一实现方式：
 *   sd.o2c.goods-issue   同时出现在 SD 订单到收款 与 MM 库存管理
 *   mm.p2p.goods-receipt 同时出现在 MM 采购到付款 与 MM 库存管理
 *   mm.p2p.invoice-verify 同时出现在 MM 采购到付款 与 FI 应付与付款
 *   fi.ap.payment        同时出现在 MM 采购到付款 与 FI 应付与付款
 */
export const processes: Process[] = [
  {
    id: 'sd.o2c',
    moduleId: 'sd',
    name: '订单到收款',
    goal: '把客户需求变成有约束力的订单，再变成发货与应收发票。',
    trigger: '客户询价或采购订单到达',
    outcome: '已开票的应收账款，等待收款清账',
    lanes: [
      { stepId: 'sd.o2c.inquiry', col: 0, row: 1 },
      { stepId: 'sd.o2c.create-order', col: 1, row: 1 },
      { stepId: 'sd.o2c.pricing', col: 2, row: 0 },
      { stepId: 'sd.o2c.atp', col: 2, row: 1 },
      { stepId: 'sd.o2c.credit-check', col: 2, row: 2 },
      { stepId: 'sd.o2c.delivery', col: 3, row: 1 },
      { stepId: 'sd.o2c.picking', col: 4, row: 1 },
      { stepId: 'sd.o2c.goods-issue', col: 5, row: 1 },
      { stepId: 'sd.o2c.billing', col: 6, row: 1 },
      { stepId: 'sd.o2c.billing-post', col: 7, row: 1 },
      { stepId: 'sd.o2c.return', col: 6, row: 2 },
      { stepId: 'sd.o2c.credit-memo', col: 7, row: 2 },
    ],
    edges: [
      { from: 'sd.o2c.inquiry', to: 'sd.o2c.create-order' },
      { from: 'sd.o2c.create-order', to: 'sd.o2c.pricing', kind: 'system' },
      { from: 'sd.o2c.create-order', to: 'sd.o2c.atp', kind: 'system' },
      { from: 'sd.o2c.create-order', to: 'sd.o2c.credit-check', kind: 'system' },
      { from: 'sd.o2c.pricing', to: 'sd.o2c.delivery' },
      { from: 'sd.o2c.atp', to: 'sd.o2c.delivery' },
      { from: 'sd.o2c.credit-check', to: 'sd.o2c.delivery' },
      { from: 'sd.o2c.delivery', to: 'sd.o2c.picking' },
      { from: 'sd.o2c.picking', to: 'sd.o2c.goods-issue' },
      { from: 'sd.o2c.goods-issue', to: 'sd.o2c.billing' },
      { from: 'sd.o2c.billing', to: 'sd.o2c.billing-post' },
      { from: 'sd.o2c.billing', to: 'sd.o2c.return', kind: 'alt' },
      { from: 'sd.o2c.return', to: 'sd.o2c.credit-memo', kind: 'alt' },
    ],
  },
  {
    id: 'sd.pricing',
    moduleId: 'sd',
    name: '定价与条件技术',
    goal: '解释价格是怎么被算出来的 —— 以及为什么有时候算不出来。',
    trigger: '价格政策变更，或订单价格出现异常',
    outcome: '可追溯的定价结果（KONV 条件行）',
    lanes: [
      { stepId: 'sd.pricing.cond-record', col: 0, row: 0 },
      { stepId: 'sd.pricing.proc-deter', col: 1, row: 0 },
      { stepId: 'sd.o2c.pricing', col: 2, row: 0 },
      { stepId: 'sd.pricing.analyze', col: 3, row: 0 },
    ],
    edges: [
      { from: 'sd.pricing.cond-record', to: 'sd.pricing.proc-deter' },
      { from: 'sd.pricing.proc-deter', to: 'sd.o2c.pricing' },
      { from: 'sd.o2c.pricing', to: 'sd.pricing.analyze' },
    ],
  },
  {
    id: 'sd.credit',
    moduleId: 'sd',
    name: '信用与风险管理',
    goal: '在放货之前判断这笔生意该不该做，以及谁来担这个责任。',
    trigger: '新客户授信，或订单金额超过既有额度',
    outcome: '被放行或被冻结的订单',
    lanes: [
      { stepId: 'sd.credit.control-range', col: 0, row: 0 },
      { stepId: 'sd.credit.limit', col: 1, row: 0 },
      { stepId: 'sd.o2c.credit-check', col: 2, row: 0 },
      { stepId: 'sd.credit.release', col: 3, row: 0 },
    ],
    edges: [
      { from: 'sd.credit.control-range', to: 'sd.credit.limit' },
      { from: 'sd.credit.limit', to: 'sd.o2c.credit-check' },
      { from: 'sd.o2c.credit-check', to: 'sd.credit.release' },
    ],
  },
  {
    id: 'mm.p2p',
    moduleId: 'mm',
    name: '采购到付款',
    goal: '把「想买」变成「买到了、钱付对了」：请购、下单、收货、校验发票。',
    trigger: 'MRP 产生需求，或部门提出请购',
    outcome: '已入库的物料 + 已确认的应付负债',
    lanes: [
      { stepId: 'mm.p2p.requisition', col: 0, row: 1 },
      { stepId: 'mm.p2p.source', col: 1, row: 0 },
      { stepId: 'mm.p2p.po', col: 1, row: 1 },
      { stepId: 'mm.p2p.po-output', col: 2, row: 0 },
      { stepId: 'mm.p2p.goods-receipt', col: 3, row: 1 },
      { stepId: 'mm.p2p.invoice-verify', col: 4, row: 1 },
      { stepId: 'mm.p2p.gr-reversal', col: 4, row: 2 },
      { stepId: 'fi.ap.payment', col: 5, row: 1 },
    ],
    edges: [
      { from: 'mm.p2p.requisition', to: 'mm.p2p.source', kind: 'system' },
      { from: 'mm.p2p.requisition', to: 'mm.p2p.po' },
      { from: 'mm.p2p.source', to: 'mm.p2p.po' },
      { from: 'mm.p2p.po', to: 'mm.p2p.po-output', kind: 'system' },
      { from: 'mm.p2p.po', to: 'mm.p2p.goods-receipt' },
      { from: 'mm.p2p.goods-receipt', to: 'mm.p2p.invoice-verify' },
      { from: 'mm.p2p.goods-receipt', to: 'mm.p2p.gr-reversal', kind: 'alt' },
      { from: 'mm.p2p.invoice-verify', to: 'fi.ap.payment' },
    ],
  },
  {
    id: 'mm.inventory',
    moduleId: 'mm',
    name: '库存与物料移动',
    goal: '守住账实一致：进、出、移、盘，每一次库存变化都留下凭证。',
    trigger: '收货、发货、转移或盘点',
    outcome: '与实物一致的库存数量，以及可追溯的物料凭证',
    lanes: [
      { stepId: 'mm.p2p.goods-receipt', col: 0, row: 0 },
      { stepId: 'sd.o2c.goods-issue', col: 1, row: 0 },
      { stepId: 'mm.inv.transfer', col: 2, row: 0 },
      { stepId: 'mm.inv.physical', col: 3, row: 0 },
      { stepId: 'mm.inv.stock-view', col: 4, row: 0 },
    ],
    edges: [
      { from: 'mm.p2p.goods-receipt', to: 'sd.o2c.goods-issue' },
      { from: 'sd.o2c.goods-issue', to: 'mm.inv.transfer' },
      { from: 'mm.inv.transfer', to: 'mm.inv.physical' },
      { from: 'mm.inv.physical', to: 'mm.inv.stock-view' },
    ],
  },
  {
    id: 'fi.ap',
    moduleId: 'fi',
    name: '应付与付款',
    goal: '把供应商的发票变成应付，再按时、按条件付出去。',
    trigger: 'MM 发票校验通过，产生应付',
    outcome: '已清账的应付，或待付清单',
    lanes: [
      { stepId: 'mm.p2p.invoice-verify', col: 0, row: 0 },
      { stepId: 'fi.ap.payment', col: 1, row: 0 },
      { stepId: 'fi.ap.clearing', col: 2, row: 0 },
    ],
    edges: [
      { from: 'mm.p2p.invoice-verify', to: 'fi.ap.payment' },
      { from: 'fi.ap.payment', to: 'fi.ap.clearing' },
    ],
  },
  {
    id: 'fi.ar',
    moduleId: 'fi',
    name: '应收与收款',
    goal: '把开出去的发票变成真金白银，并且知道哪一笔还没收回来。',
    trigger: '发票过账产生应收',
    outcome: '已清账的应收，或可催收的账龄清单',
    lanes: [
      { stepId: 'sd.o2c.billing-post', col: 0, row: 0 },
      { stepId: 'fi.ar.incoming-payment', col: 1, row: 0 },
      { stepId: 'fi.ar.aging', col: 2, row: 0 },
    ],
    edges: [
      { from: 'sd.o2c.billing-post', to: 'fi.ar.incoming-payment' },
      { from: 'fi.ar.incoming-payment', to: 'fi.ar.aging' },
    ],
  },
  {
    id: 'pp.mrp',
    moduleId: 'pp',
    name: '物料需求计划',
    goal: '用需求倒推：什么时候该买、什么时候该做、做多少。',
    trigger: '预测或销售订单进入需求，计划员跑 MRP',
    outcome: '采购申请（外购件）与生产订单（自制件），以及需要人处理的例外消息',
    lanes: [
      { stepId: 'pp.mrp.demand', col: 0, row: 1 },
      { stepId: 'pp.mrp.run', col: 1, row: 1 },
      { stepId: 'mm.p2p.requisition', col: 2, row: 0 },
      { stepId: 'pp.mrp.planned', col: 2, row: 1 },
      { stepId: 'pp.prod.order', col: 3, row: 1 },
    ],
    edges: [
      { from: 'pp.mrp.demand', to: 'pp.mrp.run' },
      { from: 'pp.mrp.run', to: 'mm.p2p.requisition', kind: 'system' },
      { from: 'pp.mrp.run', to: 'pp.mrp.planned', kind: 'system' },
      { from: 'pp.mrp.planned', to: 'pp.prod.order' },
    ],
  },
  {
    id: 'pp.production',
    moduleId: 'pp',
    name: '生产执行',
    goal: '把计划变成实物：发料、报工、入库，最后把差异算清楚。',
    trigger: '生产订单下达',
    outcome: '入库的成品 + 已结算的订单差异',
    lanes: [
      { stepId: 'pp.prod.order', col: 0, row: 0 },
      { stepId: 'pp.prod.release', col: 1, row: 0 },
      { stepId: 'pp.prod.issue', col: 2, row: 0 },
      { stepId: 'pp.prod.confirm', col: 3, row: 0 },
      { stepId: 'pp.prod.receipt', col: 4, row: 0 },
      { stepId: 'pp.prod.settle', col: 5, row: 0 },
    ],
    edges: [
      { from: 'pp.prod.order', to: 'pp.prod.release' },
      { from: 'pp.prod.release', to: 'pp.prod.issue' },
      { from: 'pp.prod.issue', to: 'pp.prod.confirm' },
      { from: 'pp.prod.confirm', to: 'pp.prod.receipt' },
      { from: 'pp.prod.receipt', to: 'pp.prod.settle' },
    ],
  },
]

export const processById = Object.fromEntries(processes.map((p) => [p.id, p]))
