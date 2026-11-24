import type { SapModule, ModuleId } from './types'

/**
 * 模块按价值链排布，不按字母：
 * 上行 采购 → 生产 → 销售（货怎么走）
 * 下行 库存 → 成本 → 财务（账怎么记）
 */
export const modules: SapModule[] = [
  {
    id: 'mm',
    code: 'MM',
    name: '物料管理',
    mission: '把供应商的货买进来：请购、采购、收货、发票校验。',
    accent: '#0d7d76',
    soft: '#eaf7f4',
    col: 0,
    row: 0,
    status: 'planned',
  },
  {
    id: 'pp',
    code: 'PP',
    name: '生产计划',
    mission: '把原料变成成品：需求计划、生产订单、工序确认。',
    accent: '#a1690b',
    soft: '#fdf5e6',
    col: 1,
    row: 0,
    status: 'planned',
  },
  {
    id: 'sd',
    code: 'SD',
    name: '销售与分销',
    mission: '唯一直接产生收入的模块：从询价到开票的完整商业链路。',
    accent: '#2f5fd0',
    soft: '#eef3fd',
    col: 2,
    row: 0,
    status: 'active',
  },
  {
    id: 'wm',
    code: 'WM',
    name: '仓储管理',
    mission: '库内作业：仓位、转储、拣配策略与实物库存。',
    accent: '#6344c6',
    soft: '#f2eefd',
    col: 0,
    row: 1,
    status: 'planned',
  },
  {
    id: 'co',
    code: 'CO',
    name: '管理会计',
    mission: '内部视角的成本与利润：成本中心、内部订单、获利分析。',
    accent: '#b02a4a',
    soft: '#fdf0f3',
    col: 1,
    row: 1,
    status: 'planned',
  },
  {
    id: 'fi',
    code: 'FI',
    name: '财务会计',
    mission: '对外法定账：总账、应收、应付、资产，一切价值的终点。',
    accent: '#2c7a44',
    soft: '#edf7f0',
    col: 2,
    row: 1,
    status: 'active',
  },
]

export const moduleById = Object.fromEntries(modules.map((m) => [m.id, m])) as Record<
  ModuleId,
  SapModule
>

/** 模块之间的主干“高速路”，画在 L0 层表达系统级流向 */
export const highways: Array<{ from: ModuleId; to: ModuleId; label: string }> = [
  { from: 'mm', to: 'pp', label: '原料入库 → 生产领料' },
  { from: 'pp', to: 'sd', label: '成品入库 → 可售库存' },
  { from: 'sd', to: 'fi', label: '开票 → 应收' },
  { from: 'mm', to: 'wm', label: '收货 → 库存' },
]
