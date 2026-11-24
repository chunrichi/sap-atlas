import type { Process } from './types'

/**
 * 布局是手工声明的（col / row），不是自动算的。
 * 原因：用户靠空间记忆找东西，位置一旦抖动就迷路。
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
]

export const processById = Object.fromEntries(processes.map((p) => [p.id, p]))
