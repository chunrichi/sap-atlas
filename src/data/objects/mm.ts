import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`
const hub = (api: string) => `https://api.sap.com/api/${api}/overview`

/**
 * MM 采购与库存的开发对象。
 * 一条经验：MM 的 BAPI 大多「只报成功，不报业务失败」——
 * 必须自己读 RETURN 表，否则会出现 BAPI 返回成功但单据不存在的经典事故。
 */
export const mmObjects: DevObject[] = [
  /* ── 采购申请 ── */
  {
    id: 'bapi.REQUISITION_CREATE',
    type: 'bapi',
    techName: 'BAPI_REQUISITION_CREATE',
    title: '创建采购申请',
    purpose:
      '批量建 PR 的标准入口，常用于把外部系统（MES、SRM、BTP 应用）的需求灌进 SAP。一次调用只能建一个抬头，但可带多行。',
    params: [
      { name: 'REQUISITION_ITEMS', desc: '行项目表：物料、数量、交货日期、工厂、采购组' },
      { name: 'REQUISITION_ACCOUNT_ASSIGNMENT', desc: '科目分配，成本中心采购必填' },
      { name: 'NUMBER', desc: '返回的 PR 号（导出参数）' },
      { name: 'RETURN', desc: '必须逐行检查 TYPE = \'E\' 或 \'A\'' },
    ],
    pitfalls: [
      '返回 RETURN 里有 E 类型消息时，PR 可能已经部分创建 —— 不能简单重试，要先按 NUMBER 查。',
      '物料主数据必须已 extended 到该工厂，否则报「物料未维护」而不是「工厂不存在」。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_REQUISITION_CREATE') }],
  },
  {
    id: 'table.EBAN',
    type: 'table',
    techName: 'EBAN',
    title: '采购申请行项目表',
    purpose:
      '每行一个 PR 行项目。BANFN（申请号）+ BNFPO（行号）是主键；LOEKZ 是删除标记，EBAN 的数据量在制造企业里通常很大。',
    params: [
      { name: 'BANFN / BNFPO', desc: '申请号 + 行号，联合主键' },
      { name: 'MATNR / WERKS', desc: '物料 + 工厂' },
      { name: 'MENGE / MEINS', desc: '数量与单位' },
      { name: 'LOEKZ', desc: '删除标记，统计时务必过滤' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EBAN purchase requisition table') }],
  },
  {
    id: 'userexit.EXIT_SAPLMEREQ_005',
    type: 'userexit',
    techName: 'EXIT_SAPLMEREQ_005',
    title: 'PR 保存前增强',
    purpose:
      '在采购申请保存前修改或校验行项目。常见用途：强制把某个成本中心改成默认值、按物料自动带出采购组、拦截不合规请购。',
    params: [
      { name: 'I_MEREQ_ITEM', desc: '当前行项目（结构），可读可改' },
      { name: 'I_EBAN', desc: '数据库层面的行项目快照' },
      { name: 'EXIT_SAPLMEREQ_005', desc: '需在 CMOD 中挂到增强 MEREQ001' },
    ],
    pitfalls: [
      '这里抛出的错误消息不会阻止保存，必须用 MESSAGE ... TYPE \'E\' 并配合标准检查逻辑。',
      '增强点随版本变化，S/4 上优先用 BAdI ME_REQ_POSTED / ME_PROCESS_REQ_CUST。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MEREQ001 user exit purchase requisition') }],
  },

  /* ── 货源与信息记录 ── */
  {
    id: 'table.EINA',
    type: 'table',
    techName: 'EINA',
    title: '采购信息记录抬头',
    purpose:
      '记录「某供应商 + 某物料 + 某采购组织」的通用数据：默认价格、最小起订量、计划交货时间。PO 创建时价格与条件就从这里带出。',
    params: [
      { name: 'INFNR', desc: '信息记录号，主键' },
      { name: 'MATNR / LIFNR', desc: '物料 + 供应商' },
      { name: 'EKORG', desc: '采购组织' },
      { name: 'LOEKZ', desc: '删除标记' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EINA purchasing info record') }],
  },
  {
    id: 'table.EINE',
    type: 'table',
    techName: 'EINE',
    title: '采购信息记录组织数据',
    purpose:
      '信息记录的组织相关层：采购组、工厂、净价、货币、价格单位。同一物料在不同工厂可以有不同价格，差异就存在这里。',
    params: [
      { name: 'INFNR', desc: '信息记录号' },
      { name: 'EKORG / WERKS', desc: '采购组织 + 工厂，决定价格的适用范围' },
      { name: 'NETPR / WAERS', desc: '净价与货币' },
      { name: 'APLFZ', desc: '计划交货时间（天），MRP 依赖它算提前期' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EINE purchasing info record plant data') }],
  },

  /* ── 采购订单 ── */
  {
    id: 'bapi.PO_CREATE1',
    type: 'bapi',
    techName: 'BAPI_PO_CREATE1',
    title: '创建采购订单',
    purpose:
      'PO 创建的标准 BAPI，支持抬头、行项目、计划行、科目分配、条件与文本。BAPI_PO_CREATE 已被它取代，新开发不应再用旧的那个。',
    params: [
      { name: 'POHEADER / POHEADERX', desc: '抬头数据与更新标记，成对出现' },
      { name: 'POITEMS / POITEMSX', desc: '行项目，项目类别、物料、数量' },
      { name: 'POACCOUNT', desc: '科目分配（K 类项目必须）' },
      { name: 'POEXPITEM', desc: '价格条件，不传则从信息记录推导' },
      { name: 'PURCHASEORDER', desc: '成功时返回 PO 号（导出参数）' },
    ],
    pitfalls: [
      '所有 X 结构必须与数据字段一一对应地打上 X，漏标记等于字段被静默忽略 —— 这是最高频的坑。',
      'COMMIT WORK 必须自己发，BAPI 不提交；不发就等于白建。',
      '项目类别不传时系统按物料主数据推导，推导不出来会建出「无科目分配」的错单。',
    ],
    snippetId: 'snip.po-create',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PO_CREATE1') }],
  },
  {
    id: 'badi.ME_PROCESS_PO_CUST',
    type: 'badi',
    techName: 'ME_PROCESS_PO_CUST',
    title: '采购订单处理 BAdI',
    purpose:
      'PO 创建/修改过程中的标准增强点，覆盖抬头、行项目、科目分配、条件各层。比 User Exit 细，是新开发的正确选择。',
    params: [
      { name: 'IF_EX_ME_PROCESS_PO_CUST~PROCESS_ITEM', desc: '行项目处理，最常用' },
      { name: 'IF_EX_ME_PROCESS_PO_CUST~CHECK', desc: '保存前校验，可抛错误阻止保存' },
      { name: 'IF_EX_ME_PROCESS_PO_CUST~POST', desc: '保存后动作，如写自定义表' },
      { name: 'IM_ITEM', desc: '行项目对象引用，通过 setter 改值' },
    ],
    pitfalls: [
      '在 CHECK 里抛错必须用 `mo_item->invalidate()` 或带消息的异常，直接 RETURN 不阻止保存。',
      '不要在 POST 里再调 BAPI 建同类单据 —— 会形成递归。',
    ],
    snippetId: 'snip.po-badi',
    docs: [{ label: 'SAP Help 检索', url: help('ME_PROCESS_PO_CUST BAdI') }],
  },
  {
    id: 'userexit.EXIT_SAPMM06E_013',
    type: 'userexit',
    techName: 'EXIT_SAPMM06E_013',
    title: 'PO 保存前 User Exit',
    purpose:
      '老版本 MM06E005 增强里的保存前出口，仍大量存在于存量代码中。新项目应改用 ME_PROCESS_PO_CUST，但维护老系统时必须认识它。',
    params: [
      { name: 'I_EKKO', desc: 'PO 抬头（结构）' },
      { name: 'I_EKPO', desc: '当前行项目' },
      { name: 'T_EBAN', desc: '相关联的采购申请，可回写' },
    ],
    pitfalls: [
      '这里的错误消息常被标准逻辑吞掉，测试时要用「消息是否出现在状态栏」来判断，而不是看保存是否成功。',
      '增强实现放在 CMOD 项目里，找代码要先查 CMOD 而不是 SE38 全局搜索。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EXIT_SAPMM06E_013') }],
  },
  {
    id: 'table.EKKO',
    type: 'table',
    techName: 'EKKO',
    title: '采购订单抬头',
    purpose:
      'PO 抬头：供应商、采购组织、公司代码、凭证日期、货币、付款条件。EBELN 是主键，一张 PO 的所有行都在 EKPO。',
    params: [
      { name: 'EBELN', desc: '采购订单号，主键' },
      { name: 'BSART', desc: '凭证类型（NB 标准、FO 框架）' },
      { name: 'LIFNR / EKORG / BUKRS', desc: '供应商、采购组织、公司代码' },
      { name: 'FRGKE', desc: '释放标识，审批状态看这里' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EKKO purchase order header') }],
  },
  {
    id: 'table.EKPO',
    type: 'table',
    techName: 'EKPO',
    title: '采购订单行项目',
    purpose:
      'PO 的每一行：物料、数量、净价、交货日期、项目类别、移动类型、发票校验标识。收货与发票校验的容差判断都基于这里的值。',
    params: [
      { name: 'EBELN / EBELP', desc: '订单号 + 行号，联合主键' },
      { name: 'PSTYP', desc: '项目类别，决定库存采购还是费用采购' },
      { name: 'EPSTP / WEBRE', desc: '收货与发票校验的标识，关掉后就无法做对应动作' },
      { name: 'NETPR / NETWR', desc: '净价与净值' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EKPO purchase order item') }],
  },
  {
    id: 'cds.I_PurchaseOrder',
    type: 'cds',
    techName: 'I_PurchaseOrder / I_PurchaseOrderItem',
    title: '采购订单 CDS 视图',
    purpose:
      'S/4HANA 的语义层视图，把 EKKO/EKPO 与供应商、物料、组织数据连好并带上语义标签。ABAP 里优先读它而不是直接 JOIN EKKO/EKPO，兼容性与可读性都更好。',
    params: [
      { name: 'I_PurchaseOrder', desc: '抬头级视图' },
      { name: 'I_PurchaseOrderItem', desc: '行项目级，含数量与价格' },
      { name: 'PurchaseOrderType', desc: '已带语义的凭证类型字段' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_PurchaseOrder CDS view') }],
  },
  {
    id: 'odata.API_PURCHASEORDER_PROCESS_SRV',
    type: 'odata',
    techName: 'API_PURCHASEORDER_PROCESS_SRV',
    title: '采购订单 OData 服务',
    purpose:
      'S/4 官方 PO API（V2），支持创建、修改、审批（含 release 操作）。BTP 与外部系统集成采购订单的首选，比 BAPI 更容易穿透网络边界。',
    params: [
      { name: 'A_PurchaseOrder', desc: 'PO 抬头实体集' },
      { name: 'to_PurchaseOrderItem', desc: '导航到行项目' },
      { name: 'to_PurchaseOrderScheduleLine', desc: '计划行，交期改了必须动它' },
      { name: 'Release', desc: '审批动作，用 POST 到 /Release 而非改字段' },
    ],
    pitfalls: [
      '改数量/日期必须同时改计划行，只改行项目会被系统覆盖回去。',
      '审批必须调用 Release 动作，直接 PATCH 释放标识字段不生效。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: hub('API_PURCHASEORDER_PROCESS_SRV') }],
  },
  {
    id: 'idoc.ORDERS05',
    type: 'idoc',
    techName: 'ORDERS05',
    title: '采购/销售订单 IDoc',
    purpose:
      '订单类 IDoc，既用于采购订单外发（消息类型 PORDCR1 等），也用于销售订单接收（ORDERS）。异步、可重发，适合批量与不稳定网络。',
    params: [
      { name: 'E1EDK01', desc: '抬头：凭证号、日期、货币' },
      { name: 'E1EDP01', desc: '行项目：物料、数量、价格' },
      { name: 'E1EDP19', desc: '物料标识（客户物料号/供应商物料号）' },
      { name: 'MESTYP', desc: '消息类型，决定处理逻辑' },
    ],
    pitfalls: [
      'IDoc 状态 51（应用层错误）要看 BD87 里的具体消息，WE02 只显示「处理失败」。',
      '重复投递不会自动去重，必须在处理函数里按业务键做幂等。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('ORDERS05 IDoc') }],
  },
  {
    id: 'table.NAST',
    type: 'table',
    techName: 'NAST',
    title: '输出消息表',
    purpose:
      '传统输出控制的待处理消息队列：单据号、消息类型、媒介、处理状态。打印、邮件、IDoc 的外发都从这里触发。',
    params: [
      { name: 'KAPPL / KSCHL', desc: '应用 + 消息类型（如 EF 采购订单）' },
      { name: 'OBJKY', desc: '对象键，通常是单据号' },
      { name: 'VSTAT', desc: '处理状态：0 待处理、1 已处理、2 失败' },
    ],
    pitfalls: [
      'NAST 只增不减，历史数据会拖慢查询；生产环境要定期归档。',
      'S/4 上部分场景已迁到 BRFplus 输出管理，NAST 里查不到不等于没配输出。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('NAST output messages table') }],
  },

  /* ── 收货 ── */
  {
    id: 'bapi.GOODSMVT_CREATE',
    type: 'bapi',
    techName: 'BAPI_GOODSMVT_CREATE',
    title: '物料凭证过账',
    purpose:
      '所有库存移动的统一入口：收货、发货、转移、冲销前反向。靠 GOODSMVT_CODE 区分动作（01 收货、02 退货、03 发货、04 转移、05 其他）。',
    params: [
      { name: 'GOODSMVT_CODE', desc: 'GM_CODE：01 收货 / 03 发货 / 04 转移 / 06 取消' },
      { name: 'GOODSMVT_HEADER', desc: '抬头：过账日期、凭证日期、抬头文本' },
      { name: 'GOODSMVT_ITEM', desc: '行项目：移动类型、物料、数量、工厂、库存地点' },
      { name: 'GOODSMVT_SERIALNUMBER', desc: '序列号，序列号管理物料必填' },
      { name: 'MATERIALDOCUMENT', desc: '成功返回的物料凭证号' },
    ],
    pitfalls: [
      'GM_CODE 与移动类型必须匹配（01 配 101、03 配 261…），配错不会报错但会过出奇怪的凭证。',
      '序列号物料漏传 SERIALNUMBER 时，BAPI 报错但已生成部分行 —— 要按 MATERIALDOCUMENT 检查再决定是否冲销。',
      '必须自己 COMMIT WORK；且要读 RETURN，BAPI 对业务错误常只返回 S 或空。',
    ],
    snippetId: 'snip.gr-post',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_GOODSMVT_CREATE') }],
  },
  {
    id: 'bapi.GOODSMVT_CANCEL',
    type: 'bapi',
    techName: 'BAPI_GOODSMVT_CANCEL',
    title: '冲销物料凭证',
    purpose:
      '按原物料凭证号 + 年度 + 行号冲销。生成反向凭证并保留双向引用，是 MBST 的编程等价物。',
    params: [
      { name: 'MATERIALDOCUMENT', desc: '被冲销的物料凭证号' },
      { name: 'MATDOCUMENTYEAR', desc: '凭证年度，跨年冲销必须对上' },
      { name: 'GOODSMVT_PSTNG_DATE', desc: '冲销过账日期' },
    ],
    pitfalls: [
      '一张凭证多行时，必须逐行指定，否则只冲第一行。',
      '已被发票校验的收货不能直接冲，要先冲发票，否则 GR/IR 留余额。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_GOODSMVT_CANCEL') }],
  },
  {
    id: 'badi.MB_MIGO_BADI',
    type: 'badi',
    techName: 'MB_MIGO_BADI',
    title: 'MIGO 增强 BAdI',
    purpose:
      'MIGO 界面层的增强：加自定义字段、校验行项目、在过账前后插入逻辑。与 BAPI_GOODSMVT_CREATE 走的是同一套校验链，所以在 MIGO 里配的增强对 BAPI 也生效。',
    params: [
      { name: 'IF_EX_MB_MIGO_BADI~CHECK_ITEM', desc: '行项目校验，可抛错误' },
      { name: 'IF_EX_MB_MIGO_BADI~LINE_MODIFY', desc: '修改行项目数据' },
      { name: 'IF_EX_MB_MIGO_BADI~POST_DOCUMENT', desc: '过账后动作' },
      { name: 'IS_GOITEM', desc: 'MIGO 行项目结构，字段极多' },
    ],
    pitfalls: [
      '这个 BAdI 只在 MIGO 事务里触发；走 MB_CREATE_GOODS_MOVEMENT 的旧程序不会进。',
      '在 POST_DOCUMENT 里 COMMIT 会造成凭证号跳号，不要这么做。',
    ],
    snippetId: 'snip.migo-badi',
    docs: [{ label: 'SAP Help 检索', url: help('MB_MIGO_BADI') }],
  },
  {
    id: 'table.MKPF',
    type: 'table',
    techName: 'MKPF',
    title: '物料凭证抬头',
    purpose:
      '物料凭证抬头：凭证号、年度、过账日期、移动类型汇总、参考单据。与 MSEG 一对一（一张凭证多行则一对多）。',
    params: [
      { name: 'MBLNR / MJAHR', desc: '凭证号 + 年度，联合主键' },
      { name: 'BUDAT / BLDAT', desc: '过账日期与凭证日期，财务期间由 BUDAT 决定' },
      { name: 'XABLN', desc: '参考交货单/采购订单号（部分场景）' },
      { name: 'USNAM', desc: '过账用户，审计常用' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MKPF material document header') }],
  },
  {
    id: 'table.MSEG',
    type: 'table',
    techName: 'MSEG',
    title: '物料凭证行项目',
    purpose:
      '库存变动的唯一事实表：每一行是一次数量变化。库存报表、收发存、追溯全部基于它。数据量极大，查询必须带凭证号或物料+日期。',
    params: [
      { name: 'MBLNR / MJAHR / ZEILE', desc: '凭证号 + 年度 + 行号，联合主键' },
      { name: 'BWART', desc: '移动类型，决定借贷方向与是否产生会计凭证' },
      { name: 'MENGE / MEINS', desc: '数量与单位（注意：不是基本单位）' },
      { name: 'SHKZG', desc: '借贷标识，S 为减少、H 为增加' },
      { name: 'EBELN / EBELP', desc: '关联采购订单行，收货追溯靠它' },
    ],
    pitfalls: [
      'S/4HANA 里 MSEG 已改为 MATDOC 的兼容视图，直接 SELECT 仍然可用但性能不如 MATDOC。',
      'MENGE 是凭证单位数量，换算基本单位要乘 UMWFZ，直接用会算错库存。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MSEG material document item MATDOC') }],
  },
  {
    id: 'table.MARD',
    type: 'table',
    techName: 'MARD',
    title: '物料的库存地点库存',
    purpose:
      '按「物料 + 工厂 + 库存地点」存放当前库存与非限制使用库存。实时库存查询的最小粒度表，MMBE 的底层数据来源之一。',
    params: [
      { name: 'MATNR / WERKS / LGORT', desc: '物料 + 工厂 + 库存地点，联合主键' },
      { name: 'LABST', desc: '非限制使用库存' },
      { name: 'EINME / SPEME', desc: '质检库存、冻结库存' },
      { name: 'INSME', desc: '在检库存' },
    ],
    pitfalls: [
      'MARD 只是「当前值」，没有历史；要历史必须查 MSEG/MATDOC。',
      '特殊库存（寄售、客户库存、销售订单库存）不在这张表，别拿它算可用量。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MARD storage location stock') }],
  },
  {
    id: 'cds.I_MaterialDocumentItem',
    type: 'cds',
    techName: 'I_MaterialDocumentItem',
    title: '物料凭证行项目 CDS',
    purpose:
      'S/4 语义层里的物料凭证行，已关联移动类型文本、物料描述、工厂名称。报表优先用它，省掉一堆 JOIN 与文本表。',
    params: [
      { name: 'MaterialDocument / MaterialDocumentYear', desc: '凭证号 + 年度' },
      { name: 'GoodsMovementType', desc: '带语义的移动类型' },
      { name: 'MaterialDocumentItem', desc: '行号' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_MaterialDocumentItem CDS') }],
  },
  {
    id: 'cds.I_MaterialStock',
    type: 'cds',
    techName: 'I_MaterialStock',
    title: '库存 CDS 视图',
    purpose:
      '把 MARD/MCHB/MSSL 等各类库存汇总成统一口径，含特殊库存与批次维度。做库存报表的正确起点，比自己拼 MARD 安全。',
    params: [
      { name: 'Material / Plant / StorageLocation', desc: '维度字段' },
      { name: 'MatlWrhsStkQtyInMatlBaseUnit', desc: '基本单位库存数量' },
      { name: 'InventoryStockType', desc: '库存类型：非限制、质检、冻结、退货' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_MaterialStock CDS view') }],
  },
  {
    id: 'odata.API_MATERIAL_DOCUMENT_SRV',
    type: 'odata',
    techName: 'API_MATERIAL_DOCUMENT_SRV',
    title: '物料凭证 OData 服务',
    purpose:
      'S/4 官方物料凭证 API（V2），可读可建。移动类型、数量、参考单据都能传，适合 WMS/MES 与 SAP 做库存同步。',
    params: [
      { name: 'A_MaterialDocumentHeader', desc: '凭证抬头实体集' },
      { name: 'to_MaterialDocumentItem', desc: '行项目导航' },
      { name: 'GoodsMovementType', desc: '移动类型，写入时必填' },
      { name: 'GoodsMovementCode', desc: '与 BAPI 的 GM_CODE 同义' },
    ],
    pitfalls: [
      '一次 POST 只能建一张凭证，批量要循环并自己处理部分失败。',
      '过账日期决定会计期间，跨月补录要先确认期间是否已关闭。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: hub('API_MATERIAL_DOCUMENT_SRV') }],
  },
  {
    id: 'idoc.WMMBID02',
    type: 'idoc',
    techName: 'WMMBID02',
    title: '物料凭证 IDoc',
    purpose:
      '把物料凭证（收货/发货）异步推给外部仓储或 MES 系统。适合高频、允许延迟的场景，失败可重处理。',
    params: [
      { name: 'E1MBXYH', desc: '凭证抬头：移动类型、过账日期' },
      { name: 'E1MBXYI', desc: '行项目：物料、数量、库存地点' },
      { name: 'MESTYP', desc: 'WMMBXY（物料凭证分发）' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('WMMBID02 IDoc') }],
  },

  /* ── 发票校验 ── */
  {
    id: 'bapi.INCOMINGINVOICE_CREATE',
    type: 'bapi',
    techName: 'BAPI_INCOMINGINVOICE_CREATE',
    title: '创建供应商发票',
    purpose:
      'MIRO 的编程等价物：按 PO 或收货凭证建发票，自动做三单匹配与容差检查。OCR 发票识别、供应商门户对接的标准落点。',
    params: [
      { name: 'HEADERDATA', desc: '抬头：供应商、公司代码、发票日期、金额、税额' },
      { name: 'ITEMDATA', desc: '行项目：PO 号 + 行号、数量、金额、税码' },
      { name: 'INVOICEDOCNUMBER', desc: '成功返回的发票凭证号' },
      { name: 'RETURN', desc: '容差不足会在这里返回 E 或 W' },
    ],
    pitfalls: [
      '发票金额与 PO 净值差异超出容差时，BAPI 会「建成但冻结」，返回消息是 W 不是 E —— 不检查就会以为成功。',
      '税额必须自己算好传进去，BAPI 不会按税码帮你算（这点和 MIRO 界面不同）。',
      'COMMIT WORK 同样要自己发。',
    ],
    snippetId: 'snip.iv-post',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_INCOMINGINVOICE_CREATE') }],
  },
  {
    id: 'fm.MRM_INVOICE_CREATE',
    type: 'fm',
    techName: 'MRM_INVOICE_CREATE',
    title: '发票校验核心函数',
    purpose:
      'BAPI_INCOMINGINVOICE_CREATE 与 MIRO 共用的底层函数，包含完整的容差、税计算、GR/IR 冲销逻辑。需要更细控制（如强制指定过账期间）时才直接调。',
    params: [
      { name: 'I_RBKPV', desc: '发票抬头工作区' },
      { name: 'T_DRSEG', desc: '发票行（含 PO 参考）' },
      { name: 'E_RBKP', desc: '生成的发票抬头' },
    ],
    pitfalls: [
      '这是内部函数，签名随版本变化，升级时容易断；能用 BAPI 就不要用它。',
      '不处理锁与编号范围，并发调用可能撞号。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MRM_INVOICE_CREATE') }],
  },
  {
    id: 'table.RBKP',
    type: 'table',
    techName: 'RBKP',
    title: '发票校验抬头',
    purpose:
      '供应商发票抬头：发票号、供应商、金额、税额、付款条件、冻结原因。发票是否被 Block，看 RBKP-RBSTAT 与冻结标识。',
    params: [
      { name: 'BELNR / GJAHR', desc: '发票凭证号 + 年度，联合主键' },
      { name: 'LIFNR / BUKRS', desc: '供应商 + 公司代码' },
      { name: 'RMWWR', desc: '发票总金额（含税）' },
      { name: 'RBSTAT', desc: '发票状态，冻结/释放看这里' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('RBKP invoice verification header') }],
  },
  {
    id: 'table.RSEG',
    type: 'table',
    techName: 'RSEG',
    title: '发票校验行项目',
    purpose:
      '发票的每一行与 PO 行/收货行的对应关系，以及最终入账的金额与科目。三单匹配的差异就体现在这里的数量与金额字段。',
    params: [
      { name: 'BELNR / GJAHR / BUZEI', desc: '发票号 + 年度 + 行号' },
      { name: 'EBELN / EBELP', desc: '关联 PO 行' },
      { name: 'MENGE / WRBTR', desc: '数量与金额，差异分析看这两个' },
      { name: 'SHKZG', desc: '借贷标识' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('RSEG invoice verification item') }],
  },
  {
    id: 'cds.I_SupplierInvoice',
    type: 'cds',
    techName: 'I_SupplierInvoice / I_SupplierInvoiceItem',
    title: '供应商发票 CDS',
    purpose:
      'S/4 语义层的供应商发票视图，已关联供应商名称、公司代码、冻结状态文本。做应付分析报表的推荐入口。',
    params: [
      { name: 'SupplierInvoice', desc: '发票号' },
      { name: 'SupplierInvoiceStatus', desc: '带语义的状态' },
      { name: 'InvoiceGrossAmount', desc: '含税金额' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_SupplierInvoice CDS view') }],
  },
  {
    id: 'odata.API_SUPPLIERINVOICE_PROCESS_SRV',
    type: 'odata',
    techName: 'API_SUPPLIERINVOICE_PROCESS_SRV',
    title: '供应商发票 OData 服务',
    purpose:
      'S/4 官方供应商发票 API，支持创建、释放冻结、冲销。外部发票平台与 SAP 集成的标准通道。',
    params: [
      { name: 'A_SupplierInvoice', desc: '发票抬头实体集' },
      { name: 'to_SuplrInvcItemPurOrdRef', desc: '按 PO 参考的行项目，创建时必填' },
      { name: 'Release', desc: '释放冻结的动作，POST 到 /Release' },
    ],
    pitfalls: [
      '创建后若被冻结，必须再调 Release 才会计入应付；很多对接只做完创建就以为结束了。',
      '税码与税率必须显式传，服务端不推导。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: hub('API_SUPPLIERINVOICE_PROCESS_SRV') }],
  },

  /* ── 应付 ── */
  {
    id: 'table.BSIK',
    type: 'table',
    techName: 'BSIK',
    title: '应付未清项',
    purpose:
      '供应商的未清应付：发票校验与付款产生，清账后转入 BSAK。账龄、付款建议、GR/IR 余额检查都读它。',
    params: [
      { name: 'BUKRS / LIFNR / BELNR / GJAHR / BUZEI', desc: '公司代码 + 供应商 + 凭证 + 年度 + 行号' },
      { name: 'DMBTR / WRBTR', desc: '本位币与凭证货币金额' },
      { name: 'ZFBDT / ZTERM', desc: '基准日期与付款条件，算到期日靠这两个' },
      { name: 'AUGDT', desc: '清账日期，为空即未清' },
    ],
    pitfalls: [
      'S/4 里 BSIK 已是视图，底表是 ACDOCA；大批量查询会慢，尽量带供应商与公司代码。',
      'GR/IR 科目也走 BSIK，所以「应付余额」不能直接加总，要先剔除 GR/IR 科目。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BSIK vendor open items') }],
  },
  {
    id: 'table.BSAK',
    type: 'table',
    techName: 'BSAK',
    title: '应付已清项',
    purpose:
      '已清账的应付历史。对账、付款查询、供应商往来明细都查这里。与 BSIK 结构一致，只是清账后迁移过来。',
    params: [
      { name: 'BUKRS / LIFNR', desc: '公司代码 + 供应商' },
      { name: 'AUGDT / AUGBL', desc: '清账日期 + 清账凭证，指向付款凭证' },
      { name: 'DMBTR', desc: '金额' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BSAK vendor cleared items') }],
  },
  {
    id: 'table.LFA1',
    type: 'table',
    techName: 'LFA1',
    title: '供应商主数据（通用）',
    purpose:
      '供应商的通用层：名称、地址、税号、国家。公司代码层数据（付款条件、对账科目）在 LFB1，采购组织层在 LFM1 —— 三层别混。',
    params: [
      { name: 'LIFNR', desc: '供应商号，主键' },
      { name: 'NAME1 / SORTL', desc: '名称与检索词' },
      { name: 'STCD1 / STCD2', desc: '税号，发票校验与税务报表依赖' },
      { name: 'KTOKK', desc: '供应商账户组，决定字段状态' },
    ],
    pitfalls: [
      '付款条件不在 LFA1 而在 LFB1；采购相关的交货条件在 LFM1。查错层会得出「主数据没维护」的错误结论。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('LFA1 vendor master general data') }],
  },
]
