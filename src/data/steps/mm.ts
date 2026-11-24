import type { Step } from '../types'

/**
 * MM 模块步骤。
 * 与 SD 的交汇点有两个，都靠「同一步骤、两个流程」实现，而不是复制内容：
 *   - 收货过账：MM 采购到付款 & MM 库存管理
 *   - 过账发货：SD 订单到收款 & MM 库存管理（出库的库存侧属于 MM）
 */
export const mmSteps: Step[] = [
  {
    id: 'mm.p2p.requisition',
    name: '创建采购申请',
    kind: 'human',
    tcode: 'ME51N',
    fiori: 'Manage Purchase Requisitions',
    role: '需求部门 / 采购员',
    input: 'MRP 需求、手工请购单',
    output: '采购申请（EBAN）',
    intent:
      '采购申请是「内部想买」的凭证，不是对供应商的承诺。它可以由 MRP 自动产生，也可以手工提；必须经过审批策略释放，才允许转成采购订单 —— 这是采购内控的第一道闸门。',
    objectIds: [
      'userexit.EXIT_SAPLMEREQ_005',
      'table.EBAN',
      'bapi.REQUISITION_CREATE',
    ],
    note: '释放策略（Release Strategy）按金额分级。未释放的 PR 用 ME21N 参照时会直接报错，而不是静默跳过。',
  },
  {
    id: 'mm.p2p.source',
    name: '货源确定与询价',
    kind: 'system',
    tcode: 'ME41 / ME47',
    role: '采购员 / 系统自动',
    input: '采购申请行、采购信息记录',
    output: '货源清单、报价、信息记录（EINA/EINE）',
    intent:
      '决定「向谁买、按什么价买」。来源清单控制哪些供应商对该物料合法，信息记录（Info Record）带出默认价格与条件，配额安排决定多供应商之间怎么分配数量。',
    objectIds: ['table.EINA', 'table.EINE'],
    note: '缺信息记录时 PO 的价格为空、条件也带不出来；后续收货与发票校验会连带失败，排查要回到这一层。',
  },
  {
    id: 'mm.p2p.po',
    name: '创建采购订单',
    kind: 'human',
    tcode: 'ME21N',
    fiori: 'Manage Purchase Orders',
    role: '采购员',
    input: '已释放的采购申请 / 报价',
    output: '采购订单（EKKO + EKPO）',
    intent:
      '采购订单是对供应商的法律承诺：价格、数量、交期、付款条件在此固化。项目类别（Account Assignment）决定它是库存采购还是费用采购 —— 这里选错，收货与发票校验入的科目全错，且很难事后修。',
    objectIds: [
      'bapi.PO_CREATE1',
      'badi.ME_PROCESS_PO_CUST',
      'userexit.EXIT_SAPMM06E_013',
      'table.EKKO',
      'table.EKPO',
      'cds.I_PurchaseOrder',
      'odata.API_PURCHASEORDER_PROCESS_SRV',
    ],
    note: 'PO 的「项目类别 + 移动类型」组合决定了后续能否收货。K（成本中心）类采购默认不产生库存，收货直接进费用。',
  },
  {
    id: 'mm.p2p.po-output',
    name: '订单输出与传输',
    kind: 'system',
    role: '系统自动',
    input: '已保存的采购订单',
    output: '输出消息（PDF 邮件 / ORDERS05 IDoc）',
    intent:
      '把 PO 送到供应商手上。输出控制（NACE / BRFplus）按单据类型与合作伙伴决定走打印、邮件还是 IDoc。这里的失败不会阻塞业务，只会静默丢单 —— 所以要做输出监控。',
    objectIds: ['idoc.ORDERS05', 'table.NAST'],
    note: '输出失败时 PO 依然「创建成功」，业务上看不出来。用 WE02 / 输出监控查，而不是看 PO 状态。',
  },
  {
    id: 'mm.p2p.goods-receipt',
    name: '收货过账',
    kind: 'human',
    tcode: 'MIGO',
    fiori: 'Post Goods Receipt for Purchasing Document',
    role: '仓库收货员',
    input: '到货实物 + 采购订单',
    output: '物料凭证（MKPF/MSEG）+ 会计凭证',
    intent:
      '货到后按 PO 收货：库存增加，同时按移动类型 101 生成会计凭证（借库存 / 贷 GR/IR 暂估）。GR/IR 是采购与财务之间最重要的过渡科目 —— 收货与发票之间的时间差全挂在这里。',
    objectIds: [
      'bapi.GOODSMVT_CREATE',
      'badi.MB_MIGO_BADI',
      'table.MKPF',
      'table.MSEG',
      'table.MARD',
      'cds.I_MaterialDocumentItem',
      'odata.API_MATERIAL_DOCUMENT_SRV',
      'idoc.WMMBID02',
    ],
    note: '无参照 PO 的收货（直接填物料+工厂）也能过账，但会造成「收了货却对不上订单」，GR/IR 永远清不掉。生产环境应禁用。',
  },
  {
    id: 'mm.p2p.gr-reversal',
    name: '收货冲销',
    kind: 'human',
    tcode: 'MBST',
    role: '仓库主管',
    input: '已过账的物料凭证',
    output: '反向物料凭证 + 反向会计凭证',
    intent:
      '收错了、退回了、数量不对，都用冲销而不是「再做一笔反向收货」。冲销保留完整审计链：原凭证被标记为已冲销，两张凭证互相指向。',
    objectIds: ['bapi.GOODSMVT_CANCEL', 'table.MKPF', 'table.MSEG'],
    note: '已经做过发票校验的收货，冲销前必须先冲销发票，否则 GR/IR 会留下无法清账的余额。',
  },
  {
    id: 'mm.p2p.invoice-verify',
    name: '发票校验',
    kind: 'human',
    tcode: 'MIRO',
    fiori: 'Supplier Invoice Processing',
    role: '应付会计',
    input: '供应商发票 + PO + 收货凭证',
    output: '发票凭证（RBKP/RSEG）+ 应付（BSIK）',
    intent:
      '三单匹配：采购订单（该不该买、多少钱）、收货（收到了多少）、发票（供应商要多少）。数量、单价、税额任一超出容差就会被冻结（Block），必须人工释放。通过后 GR/IR 被冲销，负债正式转为应付。',
    objectIds: [
      'bapi.INCOMINGINVOICE_CREATE',
      'fm.MRM_INVOICE_CREATE',
      'table.RBKP',
      'table.RSEG',
      'table.BSIK',
      'cds.I_SupplierInvoice',
      'odata.API_SUPPLIERINVOICE_PROCESS_SRV',
    ],
    note: '「发票被冻结」九成是价格或数量差异超出容差配置，不是系统故障。先用 MRBR 看冻结原因，再决定改发票还是改 PO。',
  },

  /* ── 库存管理 ── */
  {
    id: 'mm.inv.transfer',
    name: '库存转移',
    kind: 'human',
    tcode: 'MB1B',
    role: '仓库操作员',
    input: '物料、来源与目标库存地点',
    output: '物料凭证（一步或两步）',
    intent:
      '工厂内/跨工厂转移库存。移动类型决定是否两步（先转出再转入）以及是否产生会计凭证 —— 同一公司代码内的库存地点转移通常不产生会计凭证，跨公司代码则必然产生。',
    objectIds: ['bapi.GOODSMVT_CREATE', 'table.MSEG', 'table.MARD'],
  },
  {
    id: 'mm.inv.physical',
    name: '盘点与差异调整',
    kind: 'human',
    tcode: 'MI01 / MI07',
    role: '仓库主管',
    input: '盘点结果',
    output: '盘点凭证 + 差异过账',
    intent:
      '账实相符的最后一道检查。MI01 冻结账面数量，MI04 录入实盘数，MI07 把差异过账成盘盈或盘亏 —— 差异科目是管理问题，不是技术问题，要有人解释。',
    objectIds: ['table.MSEG', 'table.MARD'],
    note: '盘点期间该物料应冻结移动，否则账面数一直变，盘点结果没有意义。',
  },
  {
    id: 'mm.inv.stock-view',
    name: '库存多层级查看',
    kind: 'document',
    tcode: 'MMBE',
    fiori: 'Material Stock - Multiple Locations',
    role: '计划员 / 仓库',
    input: '物料 + 工厂',
    output: '库存概览（非凭证）',
    intent:
      '按工厂、库存地点、批次、特殊库存（寄售、客户库存、销售订单库存）逐层展开可用库存。「系统里明明有货却不能卖」通常是因为库存挂在特殊库存或已被预留占用。',
    objectIds: ['table.MARD', 'cds.I_MaterialStock'],
  },
]

/** FI 应付：与 MM 的发票校验共用同一个步骤 */
export const fiApSteps: Step[] = [
  {
    id: 'fi.ap.payment',
    name: '自动付款',
    kind: 'system',
    tcode: 'F110',
    fiori: 'Schedule Automatic Payment',
    role: '资金 / 应付会计',
    input: '到期的应付未清项（BSIK）',
    output: '付款凭证 + 银行文件',
    intent:
      '按付款建议（Payment Proposal）挑选到期项，跑批生成付款凭证与银行付款文件。付款条件、现金折扣、付款方式都在供应商主数据与公司代码配置里决定，程序本身不做业务判断。',
    objectIds: ['bapi.ACC_DOCUMENT_POST', 'table.BSIK', 'table.LFA1'],
    note: 'F110 分「建议 → 编辑 → 执行」三步。跳过建议直接执行，是付款事故的常见成因。',
  },
  {
    id: 'fi.ap.clearing',
    name: '应付清账与账龄',
    kind: 'document',
    tcode: 'FBL1N',
    fiori: 'Manage Supplier Line Items',
    role: '应付会计',
    input: '供应商未清/已清项',
    output: '账龄清单、清账状态',
    intent:
      '付款后未清项从 BSIK 移到 BSAK。这里能回答两个关键问题：哪些还没付、哪些付了但没清（挂账）、GR/IR 还有多少余额没对平。',
    objectIds: ['table.BSIK', 'table.BSAK'],
  },
]
