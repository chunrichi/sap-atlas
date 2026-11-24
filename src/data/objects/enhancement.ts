import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`

/** 增强点：标准流程留给你插手的地方 —— 也是升级最容易出问题的地方 */
export const enhancementObjects: DevObject[] = [
  {
    id: 'badi.BADI_SD_SALES',
    type: 'badi',
    techName: 'BADI_SD_SALES',
    title: '销售凭证通用增强',
    purpose:
      '销售订单保存前后最常用的 BAdI。提供「保存前校验」「字段修改」「后续处理」等方法，覆盖抬头与行项目，是 Clean Core 下替代 User Exit 的首选。',
    params: [
      { name: 'IF_EX_BADI_SD_SALES~SAVE_DOCUMENT_PREPARE', desc: '保存前最后一道校验，可抛消息阻止保存' },
      { name: 'IF_EX_BADI_SD_SALES~ITEM_FIELDS_MODIFY', desc: '行项目字段的最后修改机会' },
      { name: 'IF_EX_BADI_SD_SALES~AFTER_SAVE', desc: '保存完成后触发，适合写自定义表或发事件' },
    ],
    snippetId: 'snip.badi-sd-sales',
    pitfalls: [
      '在 AFTER_SAVE 里做数据库更新不会与订单同一 LUW 提交，失败会留下脏数据 —— 要么用同 LUW 的增强点，要么设计补偿。',
      'BAdI 可以多层实现，执行顺序由激活顺序决定，不要假设自己唯一。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BADI_SD_SALES') }],
  },
  {
    id: 'badi.BADI_SD_BILLING',
    type: 'badi',
    techName: 'BADI_SD_BILLING',
    title: '开票增强',
    purpose:
      '在发票创建过程中干预抬头与行项目，常用于补充开票日期逻辑、修改付款条件、写入自定义字段。',
    params: [
      { name: 'IF_EX_BADI_SD_BILLING~INVOICE_DOCUMENT_ADD', desc: '发票数据补全，此时 FI 尚未过账' },
      { name: 'IF_EX_BADI_SD_BILLING~INVOICE_DOCUMENT_CHECK', desc: '保存前校验' },
    ],
    pitfalls: [
      '在此修改金额会导致与交货成本不匹配，财务对账时非常难查。',
      '开票可能由后台批处理执行，增强里不要依赖 SY-UNAME 之类的会话信息。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BADI_SD_BILLING') }],
  },
  {
    id: 'userexit.USEREXIT_MOVE_FIELD_TO_VBAK',
    type: 'userexit',
    techName: 'USEREXIT_MOVE_FIELD_TO_VBAK',
    title: '抬头字段传递（MV45AFZZ）',
    purpose:
      '在订单保存时把屏幕字段或自定义逻辑写入 VBAK 抬头。老项目里最常见的一段代码，理解它是读懂存量 ABAP 的敲门砖。',
    params: [
      { name: 'INCLUDE', desc: 'MV45AFZZ' },
      { name: 'VBAK', desc: '可读写的抬头工作区' },
      { name: 'XVBAK', desc: '更新标记，改字段后需同步置位' },
    ],
    snippetId: 'snip.userexit-vbak',
    pitfalls: [
      '改了 VBAK 但没置 XVBAK 标记，字段不会落库 —— 这是最经典的「代码明明写了却没生效」。',
      'User Exit 属于隐式增强，升级时容易被标准逻辑覆盖或失效，新开发应优先 BAdI。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MV45AFZZ USEREXIT_MOVE_FIELD_TO_VBAK') }],
  },
  {
    id: 'userexit.USEREXIT_SAVE_DOCUMENT_PREPARE',
    type: 'userexit',
    techName: 'USEREXIT_SAVE_DOCUMENT_PREPARE',
    title: '保存前校验（MV45AFZZ）',
    purpose:
      '订单真正写库之前的最后一个钩子。适合做跨表校验、必填控制、以及与外部系统的同步校验。',
    params: [
      { name: 'INCLUDE', desc: 'MV45AFZZ' },
      { name: 'MESSAGE', desc: '抛 E 类型消息即中止保存' },
    ],
    pitfalls: [
      '这里抛错误后用户已录入的数据会保留在屏幕上，但不会入库 —— 提示文案要写清楚原因。',
      '不要在这里做耗时远程调用，会直接卡住用户保存。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('USEREXIT_SAVE_DOCUMENT_PREPARE') }],
  },
  {
    id: 'userexit.USEREXIT_PRICING_PREPARE_TKOMK',
    type: 'userexit',
    techName: 'USEREXIT_PRICING_PREPARE_TKOMK',
    title: '定价前补充沟通结构（MV45AFZZ）',
    purpose:
      '定价开始前，往沟通结构 TKOMK 里塞自定义字段，让条件表可以按这些字段匹配。是「用非标准维度定价」的标准做法。',
    params: [
      { name: 'TKOMK', desc: '定价沟通结构，字段必须先在结构里追加' },
      { name: 'KOMK', desc: '抬头沟通结构' },
    ],
    pitfalls: [
      '往 TKOMK 加字段必须同步修改结构、条件表、访问顺序三处，漏一处就是静默不生效。',
      '字段必须在定价开始前赋值，定价中间过程再改无效。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('USEREXIT_PRICING_PREPARE_TKOMK') }],
  },
  {
    id: 'enhancement.VOFM',
    type: 'enhancement',
    techName: 'VOFM',
    title: '定价与计算例程',
    purpose:
      '集中管理定价、条件排斥、复制控制、输出等场景的自定义例程（ Routine ）。相比改 User Exit，它是「配置可挂载」的增强方式，可控性更好。',
    params: [
      { name: '条件价值例程', desc: '自定义价格计算公式，挂到条件类型的「计算类型」' },
      { name: '需求例程', desc: '决定某个条件是否参与定价' },
      { name: '复制控制例程', desc: '控制单据之间的字段传递' },
    ],
    pitfalls: [
      '例程编号按范围分配，跨集团传输时编号冲突会导致挂错例程。',
      '例程内抛异常会中断整个定价，错误信息往往只显示「定价错误」，排查成本高。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('VOFM routines pricing') }],
  },
]
