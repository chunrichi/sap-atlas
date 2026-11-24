import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`

/** BAPI 与函数模块：流程的「程序化入口」 */
export const abapApiObjects: DevObject[] = [
  {
    id: 'bapi.SALESORDER_CREATEFROMDAT2',
    type: 'bapi',
    techName: 'BAPI_SALESORDER_CREATEFROMDAT2',
    title: '创建销售订单',
    purpose:
      '对外创建销售订单的标准入口。一次调用可写入抬头、行项目、计划行、业务伙伴、定价条件与文本，底层走 SD_SALESDOCUMENT_CREATE，所以 BAdI 与 User Exit 全部照常触发 —— 这是它比直接写表安全的原因。',
    params: [
      { name: 'ORDER_HEADER_IN', desc: '凭证类型、销售组织、分销渠道、产品组、售达方、订单日期' },
      { name: 'ORDER_ITEMS_IN', desc: '物料、数量、工厂、库存地点、行项目类别' },
      { name: 'ORDER_SCHEDULES_IN', desc: '计划行：交货日期与数量，决定 ATP 检查口径' },
      { name: 'ORDER_PARTNERS', desc: '售达方/送达方/付款方/业务员，缺了会按客户主数据推导' },
      { name: 'ORDER_CONDITIONS_IN', desc: '手工指定的定价条件，需与 INX 结构成对出现' },
      { name: 'SALESDOCUMENT', desc: '出参：新生成的订单号' },
      { name: 'RETURN', desc: '消息表，必须逐行检查 TYPE' },
    ],
    snippetId: 'snip.so-create',
    pitfalls: [
      'RETURN 里出现 W 不代表失败，只有 E / A 才需要回滚；一律判 E 会误杀大量正常单据。',
      '创建成功后必须 CALL BAPI_TRANSACTION_COMMIT 且 EXPORTING wait = \'X\'，否则紧接着查 VBAK 会查不到。',
      '想指定价格就必须同时填 ORDER_CONDITIONS_IN 与 ORDER_CONDITIONS_INX，否则定价过程会重新算一遍覆盖掉。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_SALESORDER_CREATEFROMDAT2') }],
  },
  {
    id: 'bapi.DELIVERYPROCESSING_EXEC',
    type: 'bapi',
    techName: 'BAPI_DELIVERYPROCESSING_EXEC',
    title: '创建或修改交货单',
    purpose:
      '把到期订单行转成交货单。REQUEST 表逐行描述「参照哪张订单、哪些行、多少数量」，返回结果里带回新建的交货单号。',
    params: [
      { name: 'REQUEST', desc: '请求表：参照单据类型、单号、行项目、数量、发货日期' },
      { name: 'RESULT', desc: '结果表：新建/修改的交货单号与消息' },
      { name: 'RETURN', desc: '整体消息表' },
    ],
    pitfalls: [
      '一次只能处理一类操作（创建或修改），混用会被拒绝。',
      '交货单创建后不会自动过账发货，还需要单独调用 BAPI_OUTB_DELIVERY_CONFIRM_DEC。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_DELIVERYPROCESSING_EXEC') }],
  },
  {
    id: 'bapi.OUTB_DELIVERY_CONFIRM_DEC',
    type: 'bapi',
    techName: 'BAPI_OUTB_DELIVERY_CONFIRM_DEC',
    title: '过账发货',
    purpose:
      '对已存在的交货单执行发货过账：生成物料凭证、减少库存、结转销售成本，并同步更新交货单状态。这是 O2C 中第一个产生会计凭证的动作。',
    params: [
      { name: 'HEADER_DATA', desc: '含实际发货日期（WADAT_IST），决定过账期间' },
      { name: 'ITEMS', desc: '要过账的行项目与数量，可部分过账' },
      { name: 'RETURN', desc: '消息表，E 类型必须处理' },
    ],
    snippetId: 'snip.gi-post',
    pitfalls: [
      '过账期间（MM 期间）必须已打开，否则报「期间未开」——这是最常见的失败原因。',
      '过账不可逆，只能用 VL09 冲销；程序里要留好冲销路径，不要假设永远成功。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_OUTB_DELIVERY_CONFIRM_DEC') }],
  },
  {
    id: 'bapi.BILLINGDOC_CREATEFROMDATA',
    type: 'bapi',
    techName: 'BAPI_BILLINGDOC_CREATEFROMDATA',
    title: '创建发票',
    purpose:
      '参照交货单创建发票，数量自动取自实际发货量。创建成功后立即生成 FI 会计凭证与应收未清项。',
    params: [
      { name: 'BILLINGDOC_HEADER_IN', desc: '开票类型、开票日期、参照单据' },
      { name: 'BILLINGDOC_ITEMS_IN', desc: '参照交货单行与开票数量' },
      { name: 'BILLINGDOC_HEADER_INX', desc: '字段更新标记，与 IN 结构成对' },
      { name: 'BILLINGDOC', desc: '出参：发票号' },
    ],
    snippetId: 'snip.billing-create',
    pitfalls: [
      '开票日期决定 FI 过账期间，跨月开票会直接改变当月收入 —— 这个参数不要用系统日期想当然。',
      '同一交货单重复开票会被开票相关检查拦截，但程序里仍应先查 VBRP 的参照关系。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_BILLINGDOC_CREATEFROMDATA') }],
  },
  {
    id: 'bapi.MATERIAL_AVAILABILITY',
    type: 'bapi',
    techName: 'BAPI_MATERIAL_AVAILABILITY',
    title: '查询可用数量（ATP）',
    purpose:
      '查询某物料在指定工厂、指定日期下的可承诺数量。纯查询，不占用量、不写 VBBE，适合下单前的实时校验。',
    params: [
      { name: 'MATERIAL / PLANT / UNIT', desc: '物料、工厂、计量单位' },
      { name: 'WMDATUM', desc: '需求日期，ATP 按此日期回溯供给' },
      { name: 'CHECK_RULE', desc: '可用性检查规则，须与物料主数据的检查组匹配' },
      { name: 'AV_QTY_PLT', desc: '出参：该日期可承诺数量' },
    ],
    snippetId: 'snip.atp-check',
    pitfalls: [
      '出参只保留最后一次调用的结果结构，多行必须循环调用而不是拼一张表。',
      '不传 CHECK_RULE 会按默认规则算，结果与订单里看到的可能不一致。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_MATERIAL_AVAILABILITY') }],
  },
  {
    id: 'bapi.ACC_DOCUMENT_POST',
    type: 'bapi',
    techName: 'BAPI_ACC_DOCUMENT_POST',
    title: '会计凭证过账',
    purpose:
      '通用的 FI 凭证过账接口，收款、清账、调整都能用。用 ACCOUNTAR 行把收款挂到具体发票上即完成清账。',
    params: [
      { name: 'DOCUMENTHEADER', desc: '凭证日期、过账日期、公司代码、货币、抬头文本' },
      { name: 'ACCOUNTAR', desc: '客户行：客户号、金额、到期日、要清账的发票号' },
      { name: 'CURRENCYAMOUNT', desc: '借贷金额，必须配平' },
      { name: 'OBJ_TYPE / OBJ_KEY', desc: '清账时指向被清的应收项' },
    ],
    snippetId: 'snip.acc-doc-post',
    pitfalls: [
      '借贷不平会直接报错，不会部分过账；金额精度按货币小数位截断，别用浮点算。',
      '自定义字段（如业务范围）必须通过 EXTENSION1 传，直接塞标准结构会被忽略。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_ACC_DOCUMENT_POST') }],
  },
  {
    id: 'fm.SD_SALESDOCUMENT_CREATE',
    type: 'fm',
    techName: 'SD_SALESDOCUMENT_CREATE',
    title: '创建销售凭证（底层）',
    purpose:
      'BAPI_SALESORDER_CREATEFROMDAT2 与事务码 VA01 共同调用的底层函数。理解它的入参结构，就理解了销售订单在系统里到底由哪些片段组成。',
    params: [
      { name: 'I_VBAK / I_VBAP', desc: '抬头与行项目的工作区' },
      { name: 'I_VBEP', desc: '计划行' },
      { name: 'I_VBPA', desc: '业务伙伴' },
      { name: 'E_VBELN', desc: '出参：凭证号' },
    ],
    pitfalls: [
      '直接调用需自行准备全部 INX 更新标记与编号范围，比用 BAPI 复杂得多。',
      '它会触发完整的 SD 增强链，调试用户出口时从这里下断点最直观。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('SD_SALESDOCUMENT_CREATE') }],
  },
  {
    id: 'fm.RV_INVOICE_CREATE',
    type: 'fm',
    techName: 'RV_INVOICE_CREATE',
    title: '开票核心引擎',
    purpose:
      'VF01 与 BAPI_BILLINGDOC_CREATEFROMDATA 背后真正做开票的函数：读参照单据、算数量与金额、写 VBRK/VBRP，并触发 FI 过账。',
    params: [
      { name: 'I_VBRK', desc: '发票抬头工作区' },
      { name: 'I_VBRP', desc: '发票行项目' },
      { name: 'E_KOMV', desc: '开票时的定价条件' },
    ],
    pitfalls: [
      '开票数量来自 LIPS 的实际发货量，不是订单量；调试「开票数量不对」应先看交货。',
      '开票类型决定是否立即过账 FI；贷项凭证类型不产生应收，方向相反。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('RV_INVOICE_CREATE') }],
  },
  {
    id: 'fm.AVAILABILITY_CHECK_CONTROLLER',
    type: 'fm',
    techName: 'AVAILABILITY_CHECK_CONTROLLER',
    title: '可用性检查控制器',
    purpose:
      'ATP 的统一入口：按检查规则分派到具体的检查逻辑，汇总库存、采购、生产、预留等供给元素，返回确认数量与日期。',
    params: [
      { name: 'MATERIAL / PLANT', desc: '检查对象' },
      { name: 'CHECK_RULE', desc: '检查规则，来自物料主数据或订单行类别' },
      { name: 'REQ_DATE', desc: '需求日期' },
    ],
    pitfalls: [
      '它按「检查规则」而不是按「物料」分派，规则配错会表现为完全不检查，而不是报错。',
      '性能敏感：大批量循环调用会明显拖慢订单保存，必要时考虑批量或异步。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('AVAILABILITY_CHECK_CONTROLLER') }],
  },
]
