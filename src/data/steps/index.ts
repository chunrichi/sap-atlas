import type { Step } from '../types'

/**
 * SD 模块的全部步骤。
 * 注意：同一 Step 被多个流程引用是正常的、也是本项目的核心设计目的。
 */
export const sdSteps: Step[] = [
  {
    id: 'sd.o2c.inquiry',
    name: '询价与报价',
    kind: 'document',
    tcode: 'VA21',
    fiori: 'Manage Sales Quotations',
    role: '销售代表',
    input: '客户需求、物料与数量',
    output: '报价单（凭证类别 Q）',
    intent:
      '在正式下单前锁定价格与交期。报价单与销售订单共用 VBAK/VBAP，靠凭证类别区分；它不占用库存，也不产生任何会计凭证。',
    objectIds: ['table.VBAK', 'table.VBAP', 'cds.I_SalesOrder'],
    note: '报价被接受后可用 VA01「参照报价创建」直接带出全部行项目，避免重复录入。',
  },
  {
    id: 'sd.o2c.create-order',
    name: '创建销售订单',
    kind: 'human',
    tcode: 'VA01',
    fiori: 'Create Sales Orders',
    role: '销售内勤',
    input: '客户 PO / 报价单',
    output: '销售订单（VBAK + VBAP）',
    intent:
      '把商业约定固化成系统凭证：客户、物料、数量、价格、交期在这一刻全部确定。后续的交货、开票都只能从这张单派生，不能凭空产生。',
    objectIds: [
      'bapi.SALESORDER_CREATEFROMDAT2',
      'fm.SD_SALESDOCUMENT_CREATE',
      'badi.BADI_SD_SALES',
      'userexit.USEREXIT_MOVE_FIELD_TO_VBAK',
      'userexit.USEREXIT_SAVE_DOCUMENT_PREPARE',
      'table.VBAK',
      'table.VBAP',
      'odata.API_SALES_ORDER_SRV',
      'idoc.ORDERS',
    ],
    note: '保存瞬间依次触发：定价 → 可用性检查 → 信用检查，任一项失败都会阻止订单进入「已确认」状态。',
  },
  {
    id: 'sd.o2c.pricing',
    name: '定价确定',
    kind: 'system',
    role: '系统自动',
    input: '定价过程 + 条件记录',
    output: '条件行（KONV）',
    intent:
      '按定价过程逐级查找条件记录，算出基础价、折扣、附加费与税。定价结果在保存时固化进 KONV —— 之后修改条件记录不会改变历史单据，这是价格追溯能成立的前提。',
    objectIds: ['table.KONV', 'userexit.USEREXIT_PRICING_PREPARE_TKOMK', 'enhancement.VOFM'],
    note: '净价为 0 或税算错，九成是定价过程没确定到，而不是条件记录没维护。',
  },
  {
    id: 'sd.o2c.atp',
    name: '可用性检查',
    kind: 'system',
    role: '系统自动',
    input: '订单行的计划行日期',
    output: '可承诺量 ATP（VBBE）',
    intent:
      '按计划交货日期回溯现有库存、采购订单、生产订单和在途调拨，判断这一行能不能按期交付。不满足时可以拆分交货、改期，或者直接拒单。',
    objectIds: ['bapi.MATERIAL_AVAILABILITY', 'fm.AVAILABILITY_CHECK_CONTROLLER', 'table.VBBE'],
    note: 'ATP 只在「计划行类别」允许检查时才执行；很多“为什么没检查”的疑问其实出在计划行配置。',
  },
  {
    id: 'sd.o2c.credit-check',
    name: '信用检查',
    kind: 'system',
    role: '系统自动',
    input: '客户信用额度 + 未清应收',
    output: '信用状态（VBAK-CMGST）',
    intent:
      '按信用控制范围汇总未清应收与在途订单价值，与客户额度比较。超限则订单进入信用冻结，后续交货被阻止 —— 这是 SD 与 FI 之间最早、也最有效的一道闸门。',
    objectIds: ['table.KNKK', 'table.VBAK'],
    note: '信用检查发生在订单保存时，不是交货时；所以额度被占用的是「订单金额」而非「已发货金额」。',
  },
  {
    id: 'sd.o2c.delivery',
    name: '创建交货单',
    kind: 'human',
    tcode: 'VL01N',
    fiori: 'Create Outbound Deliveries',
    role: '仓库文员',
    input: '到期的订单行',
    output: '交货单（LIKP + LIPS）',
    intent:
      '把订单行转成「实际要出库的货」：确定发货点、装运条件、路线与计划发货日期。一张订单可以拆成多张交货单，这是部分交货的实现方式。',
    objectIds: [
      'bapi.DELIVERYPROCESSING_EXEC',
      'table.LIKP',
      'table.VBFA',
      'cds.I_DeliveryDocument',
      'idoc.DELVRY03',
    ],
  },
  {
    id: 'sd.o2c.picking',
    name: '拣配与包装',
    kind: 'human',
    tcode: 'VL02N',
    role: '仓库操作员',
    input: '交货单行项目',
    output: '批次/序列号、包装单元',
    intent:
      '确定从哪个库存地点、哪个批次出货。批次管理物料在此刻定批，一旦确定就不能随意更改 —— 后续的追溯链从这里开始。',
    objectIds: ['table.LIPS'],
  },
  {
    id: 'sd.o2c.goods-issue',
    name: '过账发货',
    kind: 'human',
    tcode: 'VL02N',
    fiori: 'Post Goods Issue',
    role: '仓库主管',
    input: '已拣配的交货单',
    output: '物料凭证 + 会计凭证',
    intent:
      '库存减少，成本转入销售成本（COGS）。这是整个 O2C 里第一个真正产生会计凭证的动作 —— 发货即确认成本，而不是开票才确认。',
    objectIds: ['bapi.OUTB_DELIVERY_CONFIRM_DEC', 'table.VBFA'],
    note: '过账发货不可撤销，只能用 VL09 冲销；冲销会生成反向物料凭证和反向会计凭证。',
  },
  {
    id: 'sd.o2c.billing',
    name: '创建发票',
    kind: 'document',
    tcode: 'VF01',
    fiori: 'Create Billing Documents',
    role: '开票员',
    input: '已发货的交货单',
    output: '发票（VBRK + VBRP）',
    intent:
      '按实际交货数量开票，产生收入与应收。开票是 SD 流程的终点，同时也是 FI 应收的起点 —— 一张发票跨越了两个模块。',
    objectIds: [
      'bapi.BILLINGDOC_CREATEFROMDATA',
      'fm.RV_INVOICE_CREATE',
      'badi.BADI_SD_BILLING',
      'table.VBRK',
      'cds.I_BillingDocument',
      'idoc.INVOIC02',
    ],
    note: '开票数量取自交货数量而非订单数量，所以「订单 100 交货 80」时发票只开 80。',
  },
  {
    id: 'sd.o2c.billing-post',
    name: '发票转应收',
    kind: 'system',
    role: '系统自动',
    input: '发票抬头与行项目',
    output: '会计凭证（BKPF/BSEG）+ 应收未清项（BSID）',
    intent:
      '开票的同时生成会计凭证：借应收账款，贷收入，贷销项税。这一刻利润表出现收入，资产负债表出现应收 —— 业务单据正式变成财务事实。',
    objectIds: ['table.BKPF', 'table.BSID', 'table.VBRK'],
  },
  {
    id: 'sd.o2c.return',
    name: '退货订单与退货收货',
    kind: 'human',
    tcode: 'VA01（RE）',
    role: '销售内勤 / 仓库',
    input: '客户退货申请',
    output: '退货订单 + 退货交货单',
    intent:
      '客户退货走「退货订单（凭证类别 RE）→ 退货交货 → 收货」的镜像链路，而不是冲销原订单。收货时用移动类型 651，库存回补的同时冲减销售成本 —— 原订单和原发票都保持原样，只做增量修正。',
    objectIds: ['table.VBAK', 'table.VBAP', 'bapi.SALESORDER_CREATEFROMDAT2', 'table.MSEG'],
    note: '退货订单的物料必须带「退货」标识，否则系统会拒绝收货；这是主数据问题，不是配置问题。',
  },
  {
    id: 'sd.o2c.credit-memo',
    name: '贷项凭证',
    kind: 'document',
    tcode: 'VF11',
    role: '开票员',
    input: '退货订单 / 价格调整',
    output: '贷项凭证（VBRK，类别 G2/L2）',
    intent:
      '金额上的反向修正：不减少已开票数量，而是用贷项凭证冲减应收。退货用退货订单修数量，价格或折扣错了用贷项凭证修金额 —— 两者不能互相替代。',
    objectIds: ['bapi.BILLINGDOC_CREATEFROMDATA', 'table.VBRK', 'table.BSID'],
    note: '贷项凭证过账后同样生成会计凭证，只是借贷方向与发票相反。',
  },
]

export const fiSteps: Step[] = [
  {
    id: 'fi.ar.incoming-payment',
    name: '收款与清账',
    kind: 'human',
    tcode: 'F-28',
    fiori: 'Post Incoming Payments',
    role: '应收会计',
    input: '银行流水 / 客户付款通知',
    output: '收款凭证 + 清账结果',
    intent:
      '把客户付款挂到具体发票上。清账后未清项从 BSID 移到 BSAD，账龄重新计算。部分付款会留下残余项 —— 这是对账最常出问题的地方。',
    objectIds: ['bapi.ACC_DOCUMENT_POST', 'table.BSID'],
  },
  {
    id: 'fi.ar.aging',
    name: '账龄分析与催收',
    kind: 'document',
    tcode: 'FBL5N',
    fiori: 'Manage Accounts Receivable',
    role: '应收会计 / 信用管理',
    input: '未清应收项',
    output: '账龄分桶（30/60/90 天）',
    intent:
      '按到期日把未清应收分桶，驱动催收动作与坏账准备计提。这是 O2C 闭环的体检报告，也是信用额度能否继续放开的依据。',
    objectIds: ['table.BSID'],
  },
]

export const pricingSteps: Step[] = [
  {
    id: 'sd.pricing.cond-record',
    name: '维护条件记录',
    kind: 'human',
    tcode: 'VK11',
    role: '定价管理员',
    input: '价格政策 / 客户协议价',
    output: '条件记录（KONH/KONP）',
    intent:
      '把「什么条件下用这个价格」写成记录：物料 + 客户 + 数量阶梯 + 有效期间。订单保存时定价过程就是来这些记录里匹配的。',
    objectIds: ['table.KONV', 'enhancement.VOFM'],
  },
  {
    id: 'sd.pricing.proc-deter',
    name: '定价过程确定',
    kind: 'system',
    tcode: 'V/08',
    role: '定价管理员',
    input: '销售组织 + 分销渠道 + 产品组 + 客户定价过程',
    output: '生效的定价过程',
    intent:
      '先按「销售范围 + 客户」找到客户定价过程，再按「单据定价过程」分配到凭证类型。找不到就会「完全没有定价」，这是订单净价为 0 的头号原因。',
    objectIds: ['userexit.USEREXIT_PRICING_PREPARE_TKOMK'],
  },
  {
    id: 'sd.pricing.analyze',
    name: '分析定价结果',
    kind: 'document',
    tcode: 'VA03',
    role: '顾问 / 关键用户',
    input: '已保存的订单',
    output: '条件明细与生效原因',
    intent:
      '在订单里逐级展开条件，看每一步为什么生效、为什么被跳过、被哪个条件排斥。排查价格问题靠这个，不靠猜。',
    objectIds: ['table.KONV'],
  },
]

export const creditSteps: Step[] = [
  {
    id: 'sd.credit.control-range',
    name: '定义信用控制范围',
    kind: 'human',
    tcode: 'OB45',
    role: 'FI/SD 顾问',
    input: '公司代码与信用政策',
    output: '信用控制范围',
    intent:
      '决定「按什么维度汇总风险」：可以是公司代码级、销售组织级，也可以跨公司代码。这个划分一旦上线就很难改，因为它决定了额度被谁共享。',
    objectIds: ['table.KNKK'],
  },
  {
    id: 'sd.credit.limit',
    name: '维护客户信用额度',
    kind: 'human',
    tcode: 'FD32',
    role: '信用管理员',
    input: '财务报表 / 授信审批',
    output: '信用额度与风险类别',
    intent:
      '给客户设定可用额度与风险等级。额度是动态消耗的：订单占用、发货释放占用、开票转为应收占用，三种状态叠加才是真实的暴露额。',
    objectIds: ['table.KNKK'],
  },
  {
    id: 'sd.credit.release',
    name: '冻结订单释放',
    kind: 'human',
    tcode: 'VKM3',
    role: '信用管理员',
    input: '信用冻结的订单',
    output: '解除冻结 / 拒绝',
    intent:
      '对超限订单做人工判断：放行、部分放行还是拒绝。放行是留下审计痕迹的动作，必须有人负责 —— 这是内控要求，不是系统限制。',
    objectIds: ['table.VBAK'],
  },
]
