import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`
const hub = (api: string) => `https://api.sap.com/api/${api}/overview`

/**
 * PP 生产计划与执行的开发对象。
 * PP 的特殊之处：一张订单同时是「物流对象」和「成本对象」，
 * 所以表要分两族看 —— AFKO/AFPO/AFRU 是订单，COSP 是成本。
 */
export const ppObjects: DevObject[] = [
  /* ── 需求与 MRP ── */
  {
    id: 'table.PBIM',
    type: 'table',
    techName: 'PBIM',
    title: '独立需求抬头',
    purpose:
      '按「物料 + 工厂 + 需求类型 + 版本」存放预测需求的抬头，行项目在 PBED。MRP 展开时把它当作外部需求来源之一。',
    params: [
      { name: 'BDZEI', desc: '需求号，主键' },
      { name: 'MATNR / WERKS', desc: '物料 + 工厂' },
      { name: 'BEDAE', desc: '需求类型（如 LSF 预测、VSF 销售）' },
      { name: 'VERSB', desc: '需求版本，可并存多套预测做对比' },
    ],
    pitfalls: [
      '需求类型决定是否参与 MRP 与消耗；维护了预测但 MRP 不算，先查需求类型配置。',
      'PBIM 只存抬头，数量在 PBED，按日期展开要连 PBED。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('PBIM planned independent requirement') }],
  },
  {
    id: 'cds.I_IndependentRequirement',
    type: 'cds',
    techName: 'I_IndependentRequirement',
    title: '独立需求 CDS 视图',
    purpose: 'S/4 语义层里的预测需求视图，带物料描述与需求类型文本，做需求-消耗分析比直接读 PBIM/PBED 清晰。',
    params: [
      { name: 'Material / Plant', desc: '维度字段' },
      { name: 'RequirementType', desc: '带语义的需求类型' },
      { name: 'RequirementDate', desc: '需求日期，时间轴分析用' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_IndependentRequirement CDS') }],
  },
  {
    id: 'table.PLAF',
    type: 'table',
    techName: 'PLAF',
    title: '计划订单',
    purpose:
      'MRP 生成的补货建议以计划订单形式存放：数量、开始/完成日期、建议的订单类型。它不占用产能、不产生凭证，转换后才变成生产订单或采购申请。',
    params: [
      { name: 'PLNUM', desc: '计划订单号，主键' },
      { name: 'MATNR / PLWRK', desc: '物料 + 计划工厂' },
      { name: 'GSMNG', desc: '计划数量' },
      { name: 'PSTTR / PEDTR', desc: '开始日期与完成日期' },
      { name: 'PLART', desc: '计划订单类型，决定转换目标' },
    ],
    pitfalls: [
      'PLAF 数据量可能极大（每次 MRP 都重建），查历史计划订单意义不大，通常只看当前快照。',
      '计划订单被转换后会打上删除标记，不要用它统计在制。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('PLAF planned order') }],
  },
  {
    id: 'cds.I_PlannedOrder',
    type: 'cds',
    techName: 'I_PlannedOrder / I_PlannedOrderItem',
    title: '计划订单 CDS 视图',
    purpose:
      'S/4 语义层的计划订单视图，带物料描述、工厂名称与计划订单类型文本。做「MRP 建议清单」类报表的推荐入口。',
    params: [
      { name: 'PlannedOrder', desc: '计划订单号' },
      { name: 'PlannedOrderType', desc: '带语义的类型，决定转换目标' },
      { name: 'PlannedQuantity', desc: '计划数量' },
      { name: 'Material / ProductionPlant', desc: '物料与工厂' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_PlannedOrder CDS view') }],
  },
  {
    id: 'table.MDKP',
    type: 'table',
    techName: 'MDKP',
    title: 'MRP 清单抬头',
    purpose:
      'MRP 运行的结果清单（MD05/MD06 的底层）：每个物料一段，记录 MRP 运行日期、MRP 控制者与例外消息数量。',
    params: [
      { name: 'MATNR / WERKS', desc: '物料 + 工厂' },
      { name: 'DISST', desc: 'MRP 状态：运行过 / 有例外 / 未处理' },
      { name: 'DSDAT', desc: '上次 MRP 运行日期' },
    ],
    pitfalls: [
      '「MRP 跑过了但没建议」通常是 MRP 状态仍是「未处理」，不是没有需求。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('MDKP MRP list') }],
  },
  {
    id: 'bapi.PLANNEDORDER_CREATE',
    type: 'bapi',
    techName: 'BAPI_PLANNEDORDER_CREATE',
    title: '创建计划订单',
    purpose:
      '手工或外部系统建计划订单的标准入口。常用于「外部 APS 算完计划，回写成 SAP 计划订单」这类场景。',
    params: [
      { name: 'PLANNEDORDER_HEAD', desc: '抬头：物料、工厂、数量、日期' },
      { name: 'PLANNEDORDER_ITEM', desc: '组件需求（BOM 展开结果）' },
      { name: 'PLANNEDORDER_SCHEDULING', desc: '是否让系统按提前期排产' },
      { name: 'PLANNEDORDER_NUMBER', desc: '成功返回的计划订单号' },
    ],
    pitfalls: [
      '不传组件时系统不会自动展开 BOM，后续转换出来的生产订单会缺料。',
      '日期与提前期冲突时 BAPI 只返回警告，计划订单会被排到过去。',
    ],
    snippetId: 'snip.planned-order',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PLANNEDORDER_CREATE') }],
  },
  {
    id: 'odata.API_PLANNED_ORDER_SRV',
    type: 'odata',
    techName: 'API_PLANNED_ORDER_SRV',
    title: '计划订单 OData 服务',
    purpose: 'S/4 官方计划订单 API，可读可建。适合外部计划系统与 SAP 之间做计划同步。',
    params: [
      { name: 'A_PlannedOrder', desc: '计划订单实体集' },
      { name: 'to_PlannedOrderComponent', desc: '组件明细' },
      { name: 'PlannedOrderType', desc: '计划订单类型' },
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: hub('API_PLANNED_ORDER_SRV') }],
  },

  /* ── 生产订单 ── */
  {
    id: 'bapi.PRODORD_CREATE',
    type: 'bapi',
    techName: 'BAPI_PRODORD_CREATE',
    title: '创建生产订单',
    purpose:
      '按物料 + 工厂 + 数量建生产订单，系统按工艺路线带出工序、按 BOM 展开组件。批量建单、MES 对接、返工单自动生成都用它。',
    params: [
      { name: 'ORDERDATA', desc: '抬头：物料、工厂、订单类型、数量、日期' },
      { name: 'ORDER_OBJECTS', desc: '要带出哪些对象（工序/组件/能力）' },
      { name: 'RETURN', desc: '必须检查，缺 BOM 或工艺路线只会给警告' },
      { name: 'ORDER_NUMBER', desc: '成功返回的订单号' },
    ],
    pitfalls: [
      '订单类型不传时按物料主数据推导；推不出来会建成「无工序」的空单。',
      '不提交事务（COMMIT WORK）就什么都不会留下。',
      '组件可用性检查在下达时才真正拦截，创建阶段不会阻止缺料订单。',
    ],
    snippetId: 'snip.prodord-create',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PRODORD_CREATE') }],
  },
  {
    id: 'bapi.PRODORD_RELEASE',
    type: 'bapi',
    techName: 'BAPI_PRODORD_RELEASE',
    title: '下达生产订单',
    purpose: '把订单从「已创建」推到「已释放」（REL）。下达后才允许发料与报工，是 MES 拉取工单前的必经动作。',
    params: [
      { name: 'NUMBER', desc: '订单号，可批量' },
      { name: 'ORDER_OBJECTS', desc: '返回下达后的对象明细' },
      { name: 'DETAIL_RETURN', desc: '每条订单的下达结果（成功/失败原因）' },
    ],
    pitfalls: [
      '批量下达时部分成功是常态，必须逐条读 DETAIL_RETURN，不能只看整体返回。',
      '缺料导致下达失败时不会自动创建采购申请，缺料问题仍然要回到 MRP。',
    ],
    snippetId: 'snip.prodord-release',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PRODORD_RELEASE') }],
  },
  {
    id: 'bapi.PRODORD_GET_DETAIL',
    type: 'bapi',
    techName: 'BAPI_PRODORD_GET_DETAIL',
    title: '读取生产订单明细',
    purpose: '一次取回订单的抬头、工序、组件、能力需求与状态，是写「订单看板/齐套分析」的基础调用。',
    params: [
      { name: 'NUMBER', desc: '订单号' },
      { name: 'ORDER_HEADER', desc: '抬头（导出）' },
      { name: 'ORDER_OPERATION', desc: '工序表' },
      { name: 'ORDER_COMPONENT', desc: '组件表，齐套分析看它' },
      { name: 'ORDER_STATUS', desc: '状态表，判断 REL/TECO 用状态而不是字段' },
    ],
    pitfalls: [
      '订单状态在 STATUS 表里是「存在即有效」，不存在不代表无效 —— 别用字段判断。',
      '一次取全部对象比只取抬头慢很多，列表页应只取抬头。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PRODORD_GET_DETAIL') }],
  },
  {
    id: 'badi.WORKORDER_UPDATE',
    type: 'badi',
    techName: 'WORKORDER_UPDATE',
    title: '生产订单更新 BAdI',
    purpose:
      '生产订单创建/修改/下达/关闭全生命周期的标准增强点。校验自定义字段、联动修改组件、下达时自动补批次，都在这里做。',
    params: [
      { name: 'IF_EX_WORKORDER_UPDATE~AT_SAVE', desc: '保存前，可改数据' },
      { name: 'IF_EX_WORKORDER_UPDATE~AT_RELEASE', desc: '下达时触发' },
      { name: 'IF_EX_WORKORDER_UPDATE~BEFORE_UPDATE', desc: '写库前最后一道' },
      { name: 'IS_CAUFVD', desc: '订单抬头工作区（结构）' },
    ],
    pitfalls: [
      '在 AT_SAVE 里改数量不会重算组件需求，必须显式调用重算。',
      '这里抛异常会中断下达，批量下达时影响整批 —— 要按单号精确控制。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('WORKORDER_UPDATE BAdI') }],
  },
  {
    id: 'userexit.EXIT_SAPLCOBT_001',
    type: 'userexit',
    techName: 'EXIT_SAPLCOBT_001',
    title: '订单状态修改 User Exit',
    purpose:
      '订单状态（下达、TECO、关闭）变化时触发的老增强，存量系统里大量存在。做状态联动（如 TECO 后通知 MES）常在这里。',
    params: [
      { name: 'I_AUFNR', desc: '订单号' },
      { name: 'I_VORGANG', desc: '触发动作（如 FREI 释放、TECO）' },
      { name: 'I_OBJNR', desc: '对象号，状态查询用' },
    ],
    pitfalls: [
      '这里做耗时操作会拖慢整批下达，超过几秒就会超时。',
      '新开发应优先用 BAdI WORKORDER_UPDATE 或状态管理的 BAdI，但维护老系统必须认识它。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('EXIT_SAPLCOBT_001') }],
  },
  {
    id: 'table.AFKO',
    type: 'table',
    techName: 'AFKO',
    title: '订单抬头（生产/流程订单）',
    purpose:
      '生产订单的抬头：订单类型、物料、数量、日期、工厂、结算规则。AUFK 存通用订单主数据，AFKO 存生产特有部分，两者用 AUFNR 关联。',
    params: [
      { name: 'AUFNR', desc: '订单号，主键' },
      { name: 'AUART', desc: '订单类型（PP01 等），决定结算与字段状态' },
      { name: 'GAMNG / GMEIN', desc: '订单数量与单位' },
      { name: 'GSTRS / GLTRS', desc: '计划开始/完成日期' },
      { name: 'PLNBEZ', desc: '物料号' },
    ],
    pitfalls: [
      '查订单状态不要去 AFKO 找字段，状态在 JEST/AUFK 的状态对象上。',
      'S/4 里订单号的编号范围与订单类型绑定，跨类型并发建单会撞号。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('AFKO order header production') }],
  },
  {
    id: 'table.AFPO',
    type: 'table',
    techName: 'AFPO',
    title: '订单行项目（生产）',
    purpose: '生产订单的行项目：要生产的物料、数量、交货日期、库存地点。一张订单通常一行，但可以有多行（联产品场景）。',
    params: [
      { name: 'AUFNR / POSNR', desc: '订单号 + 行号' },
      { name: 'MATNR / PWERK', desc: '物料 + 工厂' },
      { name: 'PSMNG', desc: '订单数量' },
      { name: 'LGORT', desc: '收货库存地点，入库默认值' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('AFPO order item production') }],
  },
  {
    id: 'table.RESB',
    type: 'table',
    techName: 'RESB',
    title: '预留/组件需求',
    purpose:
      '订单的组件需求清单（BOM 展开结果）：需要什么料、多少、什么时候。发料时按它核销，齐套分析也读它。表极大，查询必须带订单号或物料+日期。',
    params: [
      { name: 'RSNUM / RSPOS', desc: '预留号 + 行号' },
      { name: 'AUFNR', desc: '关联订单号' },
      { name: 'MATNR / WERKS', desc: '组件物料 + 工厂' },
      { name: 'BDMNG / ENMNG', desc: '需求数量 / 已发料数量' },
      { name: 'XLOEK', desc: '删除标记，齐套分析要过滤' },
    ],
    pitfalls: [
      'BDMNG 是需求、ENMNG 是已发，两者之差才是待发；只查 BDMNG 会高估缺料。',
      '改订单数量后组件需求不会自动同步，需要重新展开 BOM。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('RESB reservation component requirement') }],
  },
  {
    id: 'table.AFRU',
    type: 'table',
    techName: 'AFRU',
    title: '工序确认记录',
    purpose:
      '每一次报工一行：工序、确认数量、实际工时、废品数量、过账日期。工时成本、产能负荷、效率分析全部来自它。',
    params: [
      { name: 'RUECK / RMZHL', desc: '确认号 + 计数器，联合主键' },
      { name: 'AUFNR / VORNR', desc: '订单号 + 工序号' },
      { name: 'LMNGA / XMNGA', desc: '产出数量 / 废品数量' },
      { name: 'ISMNW', desc: '实际工时（分钟），成本核算依据' },
    ],
    pitfalls: [
      '一张订单同一工序可以有多条确认（分次报工），汇总时要按工序合计而不是取第一条。',
      '冲销确认会生成反向记录，直接 SUM 会把冲销算成正数。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('AFRU confirmation actual times') }],
  },
  {
    id: 'table.AUFM',
    type: 'table',
    techName: 'AUFM',
    title: '订单的货物移动视图',
    purpose:
      '把物料凭证按订单归集：某张订单收了什么、发了什么、数量多少。做订单投入产出对比时比直接查 MSEG 方便。',
    params: [
      { name: 'AUFNR', desc: '订单号' },
      { name: 'BWART', desc: '移动类型：261 发料、101 收货' },
      { name: 'MENGE / MEINS', desc: '数量与单位' },
      { name: 'SHKZG', desc: '借贷标识，判断收还是发' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('AUFM goods movements for order') }],
  },
  {
    id: 'cds.I_ProductionOrder',
    type: 'cds',
    techName: 'I_ProductionOrder / I_ProductionOrderItem',
    title: '生产订单 CDS 视图',
    purpose: 'S/4 语义层的生产订单视图，已关联物料描述、工厂名称、订单类型文本。报表优先用它。',
    params: [
      { name: 'ManufacturingOrder', desc: '订单号（S/4 字段名已从 AUFNR 改名）' },
      { name: 'ManufacturingOrderType', desc: '带语义的订单类型' },
      { name: 'MfgOrderPlannedTotalQty', desc: '计划数量' },
    ],
    pitfalls: [
      'S/4 里 AUFNR 叫 ManufacturingOrder，从 ECC 迁过来的代码要改字段名。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_ProductionOrder CDS view') }],
  },
  {
    id: 'cds.I_ProductionOrderOperation',
    type: 'cds',
    techName: 'I_ProductionOrderOperation',
    title: '生产订单工序 CDS',
    purpose: '工序级视图：工序号、工作中心、计划/实际工时、确认状态。做产能与效率报表的入口。',
    params: [
      { name: 'ManufacturingOrder / ManufacturingOrderOperation', desc: '订单 + 工序' },
      { name: 'WorkCenter', desc: '工作中心' },
      { name: 'OpActualExecutionStartDate', desc: '实际开始日期' },
    ],
    docs: [{ label: 'SAP Help 检索', url: help('I_ProductionOrderOperation CDS') }],
  },
  {
    id: 'odata.API_PRODUCTION_ORDER_2_SRV',
    type: 'odata',
    techName: 'API_PRODUCTION_ORDER_2_SRV',
    title: '生产订单 OData 服务',
    purpose:
      'S/4 官方生产订单 API（V2），支持创建、下达（Release）、TECO。MES 与 BTP 应用对接工单的标准通道。',
    params: [
      { name: 'A_ProductionOrder', desc: '订单抬头实体集' },
      { name: 'to_ProductionOrderOperation', desc: '工序导航' },
      { name: 'to_ProductionOrderComponent', desc: '组件导航' },
      { name: 'Release', desc: '下达动作，POST 到 /Release' },
    ],
    pitfalls: [
      '下达必须用 Release 动作，PATCH 改状态字段无效。',
      '部分字段（如批量）只读，写入会被静默忽略。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: hub('API_PRODUCTION_ORDER_2_SRV') }],
  },
  {
    id: 'bapi.PRODORDCONF_CREATE_TT',
    type: 'bapi',
    techName: 'BAPI_PRODORDCONF_CREATE_TT',
    title: '工序确认（报工）',
    purpose:
      '按时间票（time ticket）确认工序的标准 BAPI。MES 报工回传 SAP 的落点，可带工时、产量、废品与批次。',
    params: [
      { name: 'TIMETICKETS', desc: '时间票表：订单、工序、产量、工时' },
      { name: 'GOODSMOVEMENTS', desc: '同时做倒冲/收货时填这里' },
      { name: 'CONFIRMATION', desc: '返回的确认号' },
      { name: 'DETAIL_RETURN', desc: '逐条结果，必须检查' },
    ],
    pitfalls: [
      '倒冲物料必须在 GOODSMOVEMENTS 里显式传，否则只确认不扣料，库存会虚高。',
      '已经最终确认的工序再确认会报错；重复投递要先做幂等。',
      '工时单位是分钟，不是小时 —— 传小时会让成本差 60 倍。',
    ],
    snippetId: 'snip.confirm',
    docs: [{ label: 'SAP Help 检索', url: help('BAPI_PRODORDCONF_CREATE_TT') }],
  },
  {
    id: 'fm.K_SEND_ORDER',
    type: 'fm',
    techName: 'K_SEND_ORDER',
    title: '订单结算',
    purpose:
      'KO88 的底层函数：把订单归集的成本按结算规则转出，并计算 WIP 或差异。批量结算与月结脚本用它。',
    params: [
      { name: 'AUFNR', desc: '订单号' },
      { name: 'PERIO / GJAHR', desc: '期间与年度' },
      { name: 'I_TESTRUN', desc: '测试运行开关，正式跑之前必须先进测试' },
    ],
    pitfalls: [
      '必须按期间顺序结算，跳期会留下无法追溯的余额。',
      '订单未 TECO 或仍有未清收货时结算，差异一定不对。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('K_SEND_ORDER settlement') }],
  },
  {
    id: 'table.COSP',
    type: 'table',
    techName: 'COSP',
    title: '成本过账行项目（外部）',
    purpose:
      '成本控制对象的实际过账行：订单投入、结算转出、差异都在这里。做订单成本明细与差异分析的主表。',
    params: [
      { name: 'OBJNR', desc: '对象号，订单成本对象的唯一标识' },
      { name: 'KSTAR', desc: '成本要素' },
      { name: 'WKG001~WKG016', desc: '按期间存放的金额（16 期），不是一行一期' },
      { name: 'MEG01~MEG016', desc: '按期间存放的数量' },
    ],
    pitfalls: [
      '金额是按期间横排的字段（WKG001…），不是行；写报表要 unpivot。',
      'COSP 是外部过账，内部过账在 COSS，两者要一起看才是完整成本。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('COSP cost postings') }],
  },
]
