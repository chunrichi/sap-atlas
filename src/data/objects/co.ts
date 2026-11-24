import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`

/**
 * CO 的开发对象：以「表 + 成本估算」为主。
 * CO 的难点不在接口，而在数据模型 —— 一行金额可能横跨 16 个期间字段（WKG001…WKG016）。
 */
export const coObjects: DevObject[] = [
  {
    id: 'table.KEKO',
    type: 'table',
    techName: 'KEKO',
    title: '成本估算抬头',
    purpose:
      '每一次标准成本估算一行：物料、工厂、估算日期、成本核算变式、总成本。一个物料可以有多次估算（不同版本/日期），只有被标记与发布的那次进物料主数据。',
    params: [
      { name: 'KALNR', desc: '成本估算号，主键' },
      { name: 'MATNR / WERKS', desc: '物料与工厂' },
      { name: 'KADAT', desc: '估算日期，决定用哪期的价格与费率' },
      { name: 'STLan / STLAL', desc: 'BOM 用途与可选 BOM，决定展开哪套结构' },
      { name: 'WRTTP', desc: '值类型：01 计划、10 实际' },
    ],
    pitfalls: [
      '同一物料会有多条历史估算，报表不加 KADAT 过滤会把历史价混进来。',
      '标记与发布状态不在 KEKO 的普通字段里，要连 CKHS/KALKTAB 或看状态表。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('KEKO costing header') }],
  },
  {
    id: 'table.KEPH',
    type: 'table',
    techName: 'KEPH',
    title: '成本估算行项目',
    purpose:
      '估算的成本明细：成本要素、成本构成（料/工/费/制造费用）、金额与数量。做成本结构分析直接读它。',
    params: [
      { name: 'KALNR / POSNR', desc: '估算号 + 行号' },
      { name: 'KSTAR', desc: '成本要素' },
      { name: 'KKZST', desc: '成本构成层级（料、工、费、外协…）' },
      { name: 'WERTN', desc: '金额' },
      { name: 'MENGE', desc: '数量（用量或工时）' },
    ],
    pitfalls: [
      '成本构成层级是配置出来的（OKNA/OKNB），不同客户的「料工费」拆分口径可能完全不同。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('KEPH costing item') }],
  },
  {
    id: 'bapi.COSTESTIMATE_GETLIST',
    type: 'bapi',
    techName: 'BAPI_COSTESTIMATE_GETLIST',
    title: '读取成本估算',
    purpose:
      '按物料/工厂/日期批量取成本估算结果，返回估算号与总成本。做「标准成本清单」类报表或对外提供成本数据的入口。',
    params: [
      { name: 'COSTINGDATE', desc: '估算日期' },
      { name: 'MATERIAL / PLANT', desc: '筛选条件' },
      { name: 'COSTESTIMATE_LIST', desc: '返回的估算号列表' },
    ],
    pitfalls: [
      '只返回抬头级数据，要明细还得再按 KALNR 读 KEPH。',
      '不传日期时默认取当天有效的估算，历史成本要显式指定。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_COSTESTIMATE_GETLIST') }],
  },
  {
    id: 'table.MBEW',
    type: 'table',
    techName: 'MBEW',
    title: '物料评估（标准价）',
    purpose:
      '物料在公司代码层的评估数据：标准价、移动平均价、价格控制标识（S/V）。CK24 发布后写的就是这里的标准价。',
    params: [
      { name: 'MATNR / BWKEY', desc: '物料 + 评估范围（通常等于工厂）' },
      { name: 'STPRS', desc: '标准价' },
      { name: 'VERPR', desc: '移动平均价' },
      { name: 'VPRSV', desc: '价格控制：S 标准价、V 移动平均' },
      { name: 'PEINH', desc: '价格单位（每 100 或每 1000）' },
    ],
    pitfalls: [
      '价格单位不是 1 的时候，STPRS 是「每 100 个」的价格 —— 直接乘数量会差 100 倍。',
      '价格控制从 V 改 S 会造成一次性重估差异，切换前必须评估影响。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MBEW material valuation') }],
  },
  {
    id: 'table.COEP',
    type: 'table',
    techName: 'COEP',
    title: 'CO 实际行项目（统一）',
    purpose:
      'S/4 里 CO 的通用行项目表，按「业务事务 + 值类型」存放成本的实际发生额。比 COSP/COSS 更统一，是新报表的首选。',
    params: [
      { name: 'OBJNR / PERIO / GJAHR', desc: '成本对象 + 期间 + 年度' },
      { name: 'KSTAR', desc: '成本要素' },
      { name: 'WKG001~WKG016', desc: '按期间横排的金额' },
      { name: 'BELTP', desc: '值类型：01 计划、04 实际' },
    ],
    pitfalls: [
      '金额按期间横排（WKG001…），不是一行一期；写 SQL 一定要 unpivot。',
      'COEP 与 COSP/COSS 有重叠，混用会重复计算，报表只选一套口径。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('COEP CO line items') }],
  },
  {
    id: 'table.CE1',
    type: 'table',
    techName: 'CE1xxxx',
    title: '获利分析行项目',
    purpose:
      '获利分析的明细表，表名随运营关注点（Operating Concern）生成（如 CE11000）。每一行是一个「特征组合 + 值字段」，是所有毛利报表的底座。',
    params: [
      { name: 'PALEDGER', desc: '分类账' },
      { name: 'VRGAR', desc: '记录类型：开票、成本、差异' },
      { name: 'ARTNR / KUNNR', desc: '产品 / 客户特征' },
      { name: 'VVBRU / VVBRG', desc: '值字段：收入、销售成本' },
    ],
    pitfalls: [
      '表名不是固定的 CE1，而是 CE1 + 运营关注点编号；硬编码表名的程序换个环境就跑不了。',
      '特征与值字段是配置出来的，字段名（ARTNR、VVBRU）也随配置变化，别假设标准字段一定存在。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('CE1 profit analysis line items operating concern') }],
  },
]
