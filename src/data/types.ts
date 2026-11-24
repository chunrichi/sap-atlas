/**
 * 知识库数据模型的唯一事实源。
 * 规则：Step 与 Process 多对多 —— 流程只存 stepId 引用，步骤内容单点维护。
 */

export type ModuleId = 'sd' | 'mm' | 'pp' | 'fi' | 'co' | 'wm'

export type SapModule = {
  id: ModuleId
  code: string
  name: string
  mission: string
  /** 主色，用于边界、徽标、连线 */
  accent: string
  /** 极浅底色，用于模块岛屿填充 */
  soft: string
  /** 在全局网格中的位置 */
  col: number
  row: number
  status: 'active' | 'planned'
}

/** 流程中的一个步骤落位：同一 Step 可在多个流程里以不同列行出现 */
export type Placement = {
  stepId: string
  col: number
  row: number
}

export type ProcessEdge = {
  from: string
  to: string
  /** flow 主干 / alt 异常分支 / system 系统动作 */
  kind?: 'flow' | 'alt' | 'system'
}

export type Process = {
  id: string
  moduleId: ModuleId
  name: string
  goal: string
  trigger: string
  outcome: string
  lanes: Placement[]
  edges: ProcessEdge[]
}

export type StepKind = 'human' | 'system' | 'document'

export type Step = {
  id: string
  name: string
  kind: StepKind
  tcode?: string
  fiori?: string
  role: string
  input?: string
  output?: string
  /** 这一步在业务上的意义 —— 顾问视角的主文案 */
  intent: string
  objectIds: string[]
  note?: string
}

export type ObjectType =
  | 'bapi'
  | 'fm'
  | 'badi'
  | 'userexit'
  | 'enhancement'
  | 'table'
  | 'cds'
  | 'odata'
  | 'idoc'

export type DevObject = {
  id: string
  type: ObjectType
  techName: string
  title: string
  /** 它解决什么问题 / 什么时候不该用 */
  purpose: string
  /** 关键技术参数（开发视角） */
  params?: Array<{ name: string; desc: string }>
  snippetId?: string
  pitfalls?: string[]
  docs?: Array<{ label: string; url: string }>
}

export type Snippet = {
  id: string
  lang: 'abap' | 'http' | 'json' | 'text'
  title: string
  body: string
  notes?: string[]
}

export const OBJECT_TYPE_LABEL: Record<ObjectType, string> = {
  bapi: 'BAPI',
  fm: '函数模块',
  badi: 'BAdI',
  userexit: 'User Exit',
  enhancement: '增强例程',
  table: '数据表',
  cds: 'CDS 视图',
  odata: 'OData',
  idoc: 'IDoc',
}
