import type { Step } from '../types'

/**
 * PP 模块步骤。
 * 与 MM 的交汇点：MRP 运算的结果之一是「采购申请」——
 * 所以 `mm.p2p.requisition` 同时出现在 MM 采购到付款 与 PP 的 MRP 流程里。
 * 这不是复制内容，而是同一个业务事实在两个视角下的落位。
 */
export const ppSteps: Step[] = [
  {
    id: 'pp.mrp.demand',
    name: '独立需求',
    kind: 'human',
    tcode: 'MD61',
    fiori: 'Manage Planned Independent Requirements',
    role: '需求计划员',
    input: '销售预测 / 历史销量 / 客户长协',
    output: '独立需求（PBIM）',
    intent:
      'MRP 的输入有两种：客户订单（真实需求）与预测（独立需求）。预测不是「猜」，而是产能与长周期物料的提前量。预测消耗（Consumption）决定订单来了以后怎么冲减预测，配错就会出现「同一份需求被算两次」。',
    objectIds: ['table.PBIM', 'cds.I_IndependentRequirement'],
    note: '预测消耗策略在物料主数据 MRP3 视图里，不在 MRP 参数里 —— 找错地方会查很久。',
  },
  {
    id: 'pp.mrp.run',
    name: 'MRP 运算',
    kind: 'system',
    tcode: 'MD01 / MD02',
    fiori: 'Schedule Material Requirements Planning',
    role: '系统自动',
    input: '需求 + 现有库存 + 在途 + BOM + 提前期',
    output: '计划订单 / 采购申请 / 例外消息',
    intent:
      '沿 BOM 逐层展开，用「可用库存 + 在途 − 需求」算净需求，再按批量规则、提前期、安全库存生成补货建议。跑完真正要看的是例外消息（MD06）—— 那才是「为什么它建议买这么多、这么早」的答案。',
    objectIds: ['table.PLAF', 'table.MDKP', 'cds.I_PlannedOrder'],
    note: 'MRP 类型 NR（净变更）只重算变化部分，跑得快但依赖上一次的干净结果；数据乱了先用 NEU 全量重算一次。',
  },
  {
    id: 'pp.mrp.planned',
    name: '计划订单与转换',
    kind: 'document',
    tcode: 'MD04 / MD11',
    role: '计划员',
    input: 'MRP 生成的补货建议',
    output: '计划订单（PLAF）→ 生产订单 / 采购申请',
    intent:
      '计划订单是 MRP 的「草案」：可以改数量、挪日期，不占用产能、不产生凭证。确认（Conversion）后才变成真正的生产订单或采购申请 —— 这一步是计划员唯一能人工干预的地方，也是计划与执行的分界。',
    objectIds: [
      'bapi.PLANNEDORDER_CREATE',
      'table.PLAF',
      'cds.I_PlannedOrder',
      'odata.API_PLANNED_ORDER_SRV',
    ],
    note: 'MD04 里一个物料的所有供需都在一条时间轴上；排查「为什么缺料」先看这里，而不是看库存报表。',
  },
  {
    id: 'pp.prod.order',
    name: '创建生产订单',
    kind: 'human',
    tcode: 'CO01',
    fiori: 'Create Production Order',
    role: '生产计划员',
    input: '计划订单 / 销售订单 / 手工',
    output: '生产订单（AFKO + AFPO + 工序 + 组件）',
    intent:
      '生产订单回答「做什么、在哪做、什么时候要」：工序从工艺路线带出，组件从 BOM 展开，产能需求按工序工时计算。创建的一刻，成本对象（订单号）就定了 —— 后面所有投入都归到它名下。',
    objectIds: [
      'bapi.PRODORD_CREATE',
      'badi.WORKORDER_UPDATE',
      'table.AFKO',
      'table.AFPO',
      'table.RESB',
      'cds.I_ProductionOrder',
      'odata.API_PRODUCTION_ORDER_2_SRV',
    ],
    note: '订单类型（如 PP01 标准生产、PP03 返工）决定编号范围、结算规则与字段状态，选错了改起来很麻烦。',
  },
  {
    id: 'pp.prod.release',
    name: '订单下达与可用性检查',
    kind: 'human',
    tcode: 'CO02',
    fiori: 'Release Production Order',
    role: '生产主管',
    input: '已创建的生产订单',
    output: '已释放订单（系统状态 REL）',
    intent:
      '下达是分水岭：只有下达后才允许发料、报工、打印工单。下达时会做物料与产能的可用性检查 —— 缺料就下不了达，这是「计划能不能执行」的真正检验，而不是 MRP 跑完就算数。',
    objectIds: [
      'bapi.PRODORD_RELEASE',
      'userexit.EXIT_SAPLCOBT_001',
      'badi.WORKORDER_UPDATE',
      'table.AFKO',
    ],
    note: '下达失败最常见的原因是组件缺料或日期落在过去；先看订单的可用性检查日志，不要直接改状态。',
  },
  {
    id: 'pp.prod.issue',
    name: '备料与发料',
    kind: 'human',
    tcode: 'MIGO（261）',
    role: '仓库 / 车间物料员',
    input: '已下达订单的组件需求（RESB）',
    output: '物料凭证（261）+ 订单投入',
    intent:
      '按订单组件发料：库存减少，成本直接进订单（WIP）。261 是「为生产订单耗用」，281 是「为销售订单耗用」，选错移动类型就到不了正确的成本对象 —— 这类错误在月末结算时才会暴露。',
    objectIds: [
      'bapi.GOODSMVT_CREATE',
      'table.RESB',
      'table.MSEG',
      'table.AUFM',
      'bapi.PRODORD_GET_DETAIL',
    ],
    note: '倒冲（Backflush）物料在报工或入库时自动发料，不需要单独 261；看见「没有发料记录却已有成本」先查倒冲标识。',
  },
  {
    id: 'pp.prod.confirm',
    name: '工序确认与报工',
    kind: 'human',
    tcode: 'CO11N',
    role: '车间班组长',
    input: '实际工时、产量、废品数量',
    output: '确认记录（AFRU）+ 工时成本',
    intent:
      '报工把实际投入的工时与产出入账：人工与制造费用按确认工时吸收进订单。确认既是成本核算的输入，也是产能负荷与效率分析的数据源 —— 报工不真实，后面的差异分析全是噪声。',
    objectIds: [
      'bapi.PRODORDCONF_CREATE_TT',
      'table.AFRU',
      'cds.I_ProductionOrderOperation',
    ],
    note: '确认有「最终确认」与「部分确认」之分；最后一道工序没做最终确认，订单不会自动进入 TECO（技术完成）。',
  },
  {
    id: 'pp.prod.receipt',
    name: '成品入库',
    kind: 'human',
    tcode: 'MIGO（101）',
    role: '仓库',
    input: '已确认的产出',
    output: '物料凭证（101）+ 库存增加',
    intent:
      '产出入库：成品库存增加，同时按标准成本贷记订单 —— 这是订单「投入 vs 产出」对比的产出侧。标准成本与同期实际投入的差额，就是后面要结算的生产差异。',
    objectIds: ['bapi.GOODSMVT_CREATE', 'table.MSEG', 'table.AUFM'],
    note: '入库数量可以小于订单数量（部分入库）；剩余数量要么继续生产，要么用 TECO 关闭。',
  },
  {
    id: 'pp.prod.settle',
    name: '订单结算与差异',
    kind: 'system',
    tcode: 'KO88',
    fiori: 'Run Settlement',
    role: '成本会计',
    input: '订单归集的投入与产出',
    output: '结算凭证 + 生产差异（进 COPA / 销售成本）',
    intent:
      '月末把订单归集的成本结算出去：投入与产出的差额就是生产差异，按价格、用量、效率拆开，流向获利分析或销售成本。不结算，订单就一直挂着 WIP，利润表永远是错的。',
    objectIds: ['fm.K_SEND_ORDER', 'table.COSP', 'table.AFKO'],
    note: '结算前必须确认订单已 TECO 且没有未清的收货/发料；否则会出现「结算了但差异对不上」。',
  },
]
