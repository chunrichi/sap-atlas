import type { DevObject } from '../types'

const help = (q: string) => `https://help.sap.com/docs/search?q=${encodeURIComponent(q)}`

/** 对外接口：OData 同步调用，IDoc 异步批量 */
export const integrationObjects: DevObject[] = [
  {
    id: 'odata.API_SALES_ORDER_SRV',
    type: 'odata',
    techName: 'API_SALES_ORDER_SRV',
    title: '销售订单 OData 服务',
    purpose:
      'S/4HANA 官方发布的销售订单标准 API（V2），实体集 A_SalesOrder / A_SalesOrderItem。BTP 应用、外部系统集成销售订单的首选，比 BAPI 更易穿透防火墙。',
    params: [
      { name: 'A_SalesOrder', desc: '订单抬头实体集，支持 $filter / $expand' },
      { name: 'A_SalesOrderItem', desc: '行项目实体集' },
      { name: 'to_Item', desc: '导航属性，一次请求带出行项目' },
      { name: '$select', desc: '只取需要的字段，宽实体集不裁剪会很慢' },
    ],
    snippetId: 'snip.odata-get',
    pitfalls: [
      '写操作（POST/PATCH）必须先取 x-csrf-token，且要复用会话 Cookie，否则 403。',
      '分页默认上限通常 100 条，不加 $top/$skiptoken 会静默截断，看起来像「数据少了」。',
      'Public Cloud 只允许 Released API，且需先配通信场景与通信安排。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: 'https://api.sap.com/api/API_SALES_ORDER_SRV/overview' }],
  },
  {
    id: 'odata.API_BILLING_DOCUMENT_SRV',
    type: 'odata',
    techName: 'API_BILLING_DOCUMENT_SRV',
    title: '开票凭证 OData 服务',
    purpose: '读取与创建开票凭证的标准 API，实体集 A_BillingDocument，支持按开票日期与类型筛选。',
    params: [
      { name: 'A_BillingDocument', desc: '发票抬头实体集' },
      { name: 'A_BillingDocumentItem', desc: '发票行项目' },
      { name: 'BillingDocumentDate', desc: '常用筛选字段，支持区间' },
    ],
    pitfalls: [
      '开票创建依赖前置交货单，API 不会替你校验业务完整性。',
      '金额字段返回的是字符串格式的十进制，前端直接 parseFloat 会丢精度。',
    ],
    docs: [{ label: 'SAP Business Accelerator Hub', url: 'https://api.sap.com/api/API_BILLING_DOCUMENT_SRV/overview' }],
  },
  {
    id: 'idoc.ORDERS',
    type: 'idoc',
    techName: 'ORDERS',
    title: '销售订单 IDoc',
    purpose:
      '异步批量传入销售订单的经典方式。消息类型 ORDERS05，基本类型 ORDERS05，通过端口与伙伴参数落到 VA01 的同等逻辑上。',
    params: [
      { name: 'E1EDK01', desc: '抬头：凭证类型、订单号、日期' },
      { name: 'E1EDP01', desc: '行项目：物料、数量、价格' },
      { name: 'E1EDK14', desc: '组织数据：销售组织、分销渠道、产品组' },
    ],
    pitfalls: [
      'IDoc 是异步的，发送成功不代表业务成功；必须看状态记录（WE02/WE05）里的应用日志。',
      '伙伴参数（WE20）配错会导致 IDoc 卡在 51/53 状态，表面「已发送」实则未入账。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('ORDERS05 IDoc sales order') }],
  },
  {
    id: 'idoc.DELVRY03',
    type: 'idoc',
    techName: 'DELVRY03',
    title: '交货 IDoc',
    purpose: '出库交货的异步接口，常用于 WMS 与 SAP 之间传递交货指令与发货确认。',
    params: [
      { name: 'E1EDL20', desc: '交货抬头' },
      { name: 'E1EDL24', desc: '交货行项目' },
      { name: 'E1EDL37', desc: '包装与处理单元' },
    ],
    pitfalls: [
      'WMS 回传发货确认走的是另一个消息方向，单向 IDoc 无法完成闭环。',
      '包装数据嵌套层级深，解析时容易丢层级关系。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('DELVRY03 IDoc delivery') }],
  },
  {
    id: 'idoc.INVOIC02',
    type: 'idoc',
    techName: 'INVOIC02',
    title: '发票 IDoc',
    purpose: '开票凭证的对外输出接口，也用于向税务/电子发票平台推送发票数据。',
    params: [
      { name: 'E1EDK01', desc: '发票抬头与金额' },
      { name: 'E1EDP01', desc: '发票行项目' },
      { name: 'E1EDK03', desc: '日期信息：开票日期、到期日' },
    ],
    pitfalls: [
      '输出控制（NACE）没配好时 IDoc 根本不会生成，排查要先看输出 determination 日志。',
      '金额为负的贷项凭证在接收端容易被当成异常数据丢弃。',
    ],
    docs: [{ label: 'SAP Help 检索', url: help('INVOIC02 IDoc billing') }],
  },
]
