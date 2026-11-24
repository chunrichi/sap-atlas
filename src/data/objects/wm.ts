import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`

/**
 * WM 的开发对象。
 * 特点：几乎没有 BAPI，全部是 L_* 函数模块 + 自己的表族（LTAK/LTAP/LQUA）。
 * S/4 上传统 WM 已不再演进，新项目应评估 EWM（/SCWM/*）。
 */
export const wmObjects: DevObject[] = [
  {
    id: 'table.LTBK',
    type: 'table',
    techName: 'LTBK',
    title: '转储请求抬头',
    purpose:
      'TR 抬头：一次「要移动」的意向，由收货、发货、内部转储触发。它不改变库存，只表示有货需要挪位置。',
    params: [
      { name: 'TRNUM', desc: '转储请求号，主键' },
      { name: 'LGNUM / BWLVS', desc: '仓库号 + 移动类型（如 101 收货上架）' },
      { name: 'BETYP', desc: '需求类型：收货 / 发货 / 转储' },
      { name: 'STATUS', desc: '处理状态，判断是否已转成 TO' },
    ],
    pitfalls: [
      'TR 生成依赖库存地点已启用 WM 视图；没启用时收货根本不产生 TR，也不会报错。',
      'TR 与 TO 不是一对一：一张 TR 可以拆成多张 TO（分批上架）。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LTBK transfer requirement') }],
  },
  {
    id: 'table.LTBP',
    type: 'table',
    techName: 'LTBP',
    title: '转储请求行项目',
    purpose: 'TR 的物料与数量明细，指向来源（收货凭证）与目标仓位类型。',
    params: [
      { name: 'TRNUM / TBPOS', desc: '请求号 + 行号' },
      { name: 'MATNR / WERKS / LGORT', desc: '物料与库存地点' },
      { name: 'MENGE / MEINS', desc: '数量与单位' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LTBP transfer requirement item') }],
  },
  {
    id: 'table.T331',
    type: 'table',
    techName: 'T331',
    title: '仓位类型配置',
    purpose:
      '定义仓位类型（如 001 高位货架、002 拣配区、900 收货区）及其上架/下架策略。仓内作业的所有规则都从这里读。',
    params: [
      { name: 'LGTYP', desc: '仓位类型，主键' },
      { name: 'LGNUM', desc: '仓库号' },
      { name: 'KZLET', desc: '上架策略（固定/随机/就近）' },
      { name: 'KZLEA', desc: '下架策略（FIFO/LIFO/批次）' },
    ],
    pitfalls: [
      '策略是配置不是代码；想改上架逻辑先看这里能不能配，别急着写增强。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('T331 storage type control') }],
  },
  {
    id: 'fm.L_TO_CREATE_SINGLE',
    type: 'fm',
    techName: 'L_TO_CREATE_SINGLE',
    title: '创建单张转储单',
    purpose:
      '按「物料 + 来源 + 目标 + 数量」直接创建 TO，最常用的 WM 接口。手工补单、MES 触发上架、自动化立库对接都用它。',
    params: [
      { name: 'I_LGNUM', desc: '仓库号' },
      { name: 'I_BWLVS', desc: '移动类型（如 101、999）' },
      { name: 'I_MATNR / I_WERKS', desc: '物料与工厂' },
      { name: 'I_ANFME', desc: '请求数量' },
      { name: 'I_VLTYP / I_NLTYP', desc: '来源仓位类型 / 目标仓位类型' },
      { name: 'E_TANUM', desc: '生成的 TO 号' },
    ],
    pitfalls: [
      '目标仓位留空时系统按策略自动找位；给死仓位会绕过策略，长期会造成仓位结构失衡。',
      '同一物料并发建 TO 时可能抢到同一个空仓位，需要靠仓位锁或串行化处理。',
      '数量超过库存会返回 E 类型消息，但 TO 可能已经建了一半，必须回滚。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('L_TO_CREATE_SINGLE') }],
  },
  {
    id: 'fm.L_TO_CREATE_DELIVERY',
    type: 'fm',
    techName: 'L_TO_CREATE_DELIVERY',
    title: '按交货单创建拣配 TO',
    purpose:
      '把一张外向交货单一次性转成拣配 TO，LT03 的底层实现。批量拣配、波次拣货的核心调用。',
    params: [
      { name: 'I_LGNUM', desc: '仓库号' },
      { name: 'I_VBELN', desc: '交货单号' },
      { name: 'I_LFART', desc: '交货类型' },
      { name: 'E_TANUM', desc: '生成的第一张 TO 号' },
    ],
    pitfalls: [
      '交货单尚未完成拣配相关检查（如批次确定）时会失败，错误信息只给「无法创建 TO」。',
      '一张交货单可能生成多张 TO（跨仓位类型），返回值只给第一张，要再查 LTAK 按 VBELN 找全。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('L_TO_CREATE_DELIVERY') }],
  },
  {
    id: 'table.LTAK',
    type: 'table',
    techName: 'LTAK',
    title: '转储单抬头',
    purpose:
      'TO 抬头：仓库号、移动类型、参考单据（收货凭证/交货单）、创建人与确认状态。仓内作业的执行记录。',
    params: [
      { name: 'LGNUM / TANUM', desc: '仓库号 + TO 号，联合主键' },
      { name: 'BWLVS', desc: '移动类型' },
      { name: 'VBELN', desc: '参考交货单（出库场景）' },
      { name: 'STATUS', desc: '确认状态：0 未确认、1 部分、2 全部' },
      { name: 'BDATU', desc: '创建日期，作业量统计用' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LTAK transfer order header') }],
  },
  {
    id: 'table.LTAP',
    type: 'table',
    techName: 'LTAP',
    title: '转储单行项目',
    purpose:
      'TO 的每一行：物料、来源仓位、目标仓位、应确认数量与实际确认数量。仓位级追溯的原始凭证。',
    params: [
      { name: 'LGNUM / TANUM / TAPOS', desc: '仓库 + TO 号 + 行号' },
      { name: 'MATNR', desc: '物料' },
      { name: 'VLTYP / VLPLA', desc: '来源仓位类型 / 仓位' },
      { name: 'NLTYP / NLPLA', desc: '目标仓位类型 / 仓位' },
      { name: 'NSOLA / NISTM', desc: '应确认数量 / 实际确认数量' },
    ],
    pitfalls: [
      'NSOLA 是计划、NISTM 是实际；两者不等就是差异，不要用 NSOLA 统计实际库存。',
      '表数据量随作业量线性增长，生产环境要定期归档。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LTAP transfer order item') }],
  },
  {
    id: 'fm.L_TO_CONFIRM',
    type: 'fm',
    techName: 'L_TO_CONFIRM',
    title: '确认转储单',
    purpose:
      '确认 TO 的实际数量与执行时间，触发仓位库存（LQUA）更新。手持终端、自动化设备回传执行结果都调它。',
    params: [
      { name: 'I_LGNUM / I_TANUM', desc: '仓库号 + TO 号' },
      { name: 'I_TAPOS', desc: '行号' },
      { name: 'I_NISTM', desc: '实际确认数量（可小于计划，即差异）' },
      { name: 'I_KZQUI', desc: '差异确认标记，必填否则报错' },
    ],
    pitfalls: [
      '实际数量与计划不一致时必须显式设置差异标记，否则直接报错。',
      '重复确认会报「TO 已确认」，接口要有幂等判断，不能靠重试。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('L_TO_CONFIRM') }],
  },
  {
    id: 'table.LQUA',
    type: 'table',
    techName: 'LQUA',
    title: '仓位库存（Quant）',
    purpose:
      '最细粒度的库存：物料 + 批次 + 仓位。仓位利用率、盘点、拣配可用量都读它。与 MARD（库存地点层级）是两套口径。',
    params: [
      { name: 'LGNUM / LGTYP / LGPLA', desc: '仓库 + 仓位类型 + 仓位' },
      { name: 'MATNR / WERKS', desc: '物料与工厂' },
      { name: 'GESME', desc: '仓位上的总数量' },
      { name: 'VERME', desc: '已锁定数量（被 TO 占用）' },
      { name: 'CHARG', desc: '批次' },
    ],
    pitfalls: [
      'LQUA 的合计与 MARD 不一致是正常的：LQUA 只含已上架的，收货区、在途 TO 不在里面。',
      'VERME 是已占用但未确认的数量，算「可用库存」必须减掉它。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LQUA quant storage bin stock') }],
  },
]
