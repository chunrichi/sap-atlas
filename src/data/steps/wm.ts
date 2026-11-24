import type { Step } from '../types'

/**
 * WM 模块步骤（LE-WM 传统仓储管理，非 EWM）。
 * 与其它模块的交汇点全部是「同一步骤再落一处」：
 *   收货过账  → MM 采购到付款 / MM 库存管理 / WM 入库
 *   交货单    → SD 订单到收款 / WM 出库
 *   过账发货  → SD 订单到收款 / MM 库存管理 / WM 出库
 */
export const wmSteps: Step[] = [
  {
    id: 'wm.inbound.tr',
    name: '生成转储请求',
    kind: 'system',
    role: '系统自动',
    input: '已过账的收货凭证',
    output: '转储请求（TR：LTBK/LTBP）',
    intent:
      '收货过账后，系统按「库存地点 → 仓位类型」的配置自动生成转储请求：货已经算入库了，但还不知道放哪个货架。TR 是「要移动」的意向，本身不产生库存变化。',
    objectIds: ['table.LTBK', 'table.LTBP', 'table.T331'],
    note: '没生成 TR 通常是收货的库存地点没有激活 WM 视图；这一步不产生凭证，所以「看不出来」是常态。',
  },
  {
    id: 'wm.inbound.to',
    name: '创建转储单',
    kind: 'human',
    tcode: 'LT03 / LT04',
    role: '仓库文员',
    input: '转储请求 + 仓位策略',
    output: '转储单（TO：LTAK/LTAP）',
    intent:
      'TR 变成 TO 时，系统才真正按上架策略（固定仓位、随机仓位、就近）算出目标仓位。TO 是仓内作业指令：从哪、到哪、多少。',
    objectIds: [
      'fm.L_TO_CREATE_SINGLE',
      'fm.L_TO_CREATE_DELIVERY',
      'table.LTAK',
      'table.LTAP',
    ],
    note: 'TO 创建时可以做「自动确认」，也可以强制人工确认 —— 后者是盘点差异与错放的主要来源控制点。',
  },
  {
    id: 'wm.inbound.confirm',
    name: '确认上架',
    kind: 'human',
    tcode: 'LT12',
    role: '仓管员',
    input: '实际放到货架上的 TO',
    output: '仓位库存（LQUA）更新 + TO 已确认',
    intent:
      '确认的那一刻，库存才真正落到具体仓位。之前它只存在于「库存地点」层级。所有仓位级盘点、拣配策略、仓位利用率都以这一步的结果为准。',
    objectIds: ['fm.L_TO_CONFIRM', 'table.LQUA', 'table.LTAP'],
    note: '确认数量与 TO 数量不一致时要走差异处理，不能靠改 TO —— 改 TO 会破坏作业记录的可追溯性。',
  },
  {
    id: 'wm.outbound.to',
    name: '拣配转储单',
    kind: 'human',
    tcode: 'LT03 / LT31',
    role: '仓库文员',
    input: '已创建的交货单',
    output: '拣配 TO（先进先出 / 批次策略决定取哪个仓位）',
    intent:
      '交货单只说要发多少，不说到哪个货架取。TO 用拣配策略（FIFO、批次到期日、固定仓位）决定实际取货位置 —— 批次管理的追溯链在这一步具体化。',
    objectIds: ['fm.L_TO_CREATE_DELIVERY', 'table.LTAK', 'table.LTAP', 'table.LQUA'],
  },
  {
    id: 'wm.outbound.confirm',
    name: '确认拣配与交接',
    kind: 'human',
    tcode: 'LT12',
    role: '仓管员',
    input: '实际取下的货',
    output: '仓位库存减少 + 待发货库存',
    intent:
      '确认拣配后，货从仓位转到发货区，但仍未出库（还没过账发货）。这一步是「实物已动、账面未动」的窗口期，也是仓库与销售最容易对不上的地方。',
    objectIds: ['fm.L_TO_CONFIRM', 'table.LQUA', 'table.LTAP'],
    note: '确认拣配后取消订单，货已离开仓位但未发货 —— 必须做反向 TO 把货放回去，不能直接删交货单。',
  },
]
