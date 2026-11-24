import type { Snippet } from './types'

export const snippets: Snippet[] = [
  {
    id: 'snip.so-create',
    lang: 'abap',
    title: '用 BAPI 创建销售订单',
    body: `DATA: ls_header   TYPE bapisdhd1,
      ls_headerx  TYPE bapisdhd1x,
      ls_item     TYPE bapisditm,
      ls_itemx    TYPE bapisditmx,
      ls_partner  TYPE bapiparnr,
      lt_items    TYPE TABLE OF bapisditm,
      lt_itemsx   TYPE TABLE OF bapisditmx,
      lt_partners TYPE TABLE OF bapiparnr,
      lt_return   TYPE TABLE OF bapiret2,
      lv_order    TYPE bapivbeln-vbeln.

" 抬头：只填业务必填项，其余交给标准推导
ls_header-doc_type   = 'OR'.
ls_header-sales_org  = '1000'.
ls_header-distr_chan = '10'.
ls_header-division   = '00'.
ls_header-purch_no_c = 'PO-2026-0042'.

" 更新标记必须与数据成对，漏一个字段就是静默丢弃
ls_headerx-updateflag = 'I'.
ls_headerx-doc_type   = abap_true.
ls_headerx-sales_org  = abap_true.
ls_headerx-distr_chan = abap_true.
ls_headerx-division   = abap_true.

ls_item-material   = 'MAT-1001'.
ls_item-target_qty = 10.
ls_item-plant      = '1000'.
APPEND ls_item TO lt_items.

ls_itemx-updateflag = 'I'.
ls_itemx-material   = abap_true.
ls_itemx-target_qty = abap_true.
ls_itemx-plant      = abap_true.
APPEND ls_itemx TO lt_itemsx.

ls_partner-partn_role = 'AG'.
ls_partner-partn_numb = '0000001000'.
APPEND ls_partner TO lt_partners.

CALL FUNCTION 'BAPI_SALESORDER_CREATEFROMDAT2'
  EXPORTING
    order_header_in  = ls_header
    order_header_inx = ls_headerx
  IMPORTING
    salesdocument    = lv_order
  TABLES
    return           = lt_return
    order_items_in   = lt_items
    order_items_inx  = lt_itemsx
    order_partners   = lt_partners.

" W 是正常提示，只有 E / A 才是失败
IF line_exists( lt_return[ type = 'E' ] ) OR line_exists( lt_return[ type = 'A' ] ).
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
  LOOP AT lt_return INTO DATA(ls_msg) WHERE type CA 'EA'.
    MESSAGE ls_msg-message TYPE 'E'.
  ENDLOOP.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING
      wait = abap_true.
ENDIF.`,
    notes: [
      'wait = abap_true 很重要：不等提交完成就返回，紧接着读 VBAK 会读不到新单。',
      '真实项目里抬头字段通常由映射表驱动，不要在这里硬编码销售组织。',
    ],
  },
  {
    id: 'snip.so-read',
    lang: 'abap',
    title: '读取订单抬头与行项目',
    body: `DATA: lt_result TYPE TABLE OF ty_order_line.

SELECT h~vbeln, h~kunnr, h~audat, h~netwr, h~waerk,
       i~posnr, i~matnr, i~kwmeng, i~werks, i~pstyv
  FROM vbak AS h
  INNER JOIN vbap AS i ON i~vbeln = h~vbeln
  INTO CORRESPONDING FIELDS OF TABLE @lt_result
  WHERE h~vkorg  = @p_vkorg
    AND h~audat >= @p_from
    AND h~vbtyp  = 'C'.        " C = 订单；不加这行会把报价也算进来

IF lt_result IS INITIAL.
  MESSAGE '没有符合条件的订单' TYPE 'S'.
  RETURN.
ENDIF.

cl_demo_output=>display( lt_result ).`,
    notes: [
      'VBTYP 区分订单(A 询价 / B 报价 / C 订单 / G 合同)，按「订单」统计时必带。',
      'S/4HANA 里更推荐用 CDS 视图 I_SalesOrder，字段是业务语义且自带权限检查。',
    ],
  },
  {
    id: 'snip.atp-check',
    lang: 'abap',
    title: '下单前查询可用数量',
    body: `DATA: lv_available TYPE mard-labst.

CALL FUNCTION 'BAPI_MATERIAL_AVAILABILITY'
  EXPORTING
    material   = 'MAT-1001'
    plant      = '1000'
    unit       = 'PC'
    check_rule = 'A'          " 必须与物料主数据的检查组一致
    wmdatum    = sy-datum
  IMPORTING
    av_qty_plt = lv_available
  EXCEPTIONS
    error_message = 1
    OTHERS        = 2.

IF sy-subrc <> 0.
  MESSAGE '可用性查询失败，请检查检查规则' TYPE 'E'.
ENDIF.

" lv_available 为负说明已有超订，不能直接给客户承诺`,
    notes: [
      '这是纯查询，不会在 VBBE 留下需求记录，可放心在前端反复调用。',
      '多物料场景必须循环调用，出参只保留最后一次结果。',
    ],
  },
  {
    id: 'snip.gi-post',
    lang: 'abap',
    title: '发货过账后如何验证结果',
    body: `" 过账是否成功，不要只看 BAPI 返回，要回到数据里确认

" 1) 交货单状态：WBSTK = 'C' 表示货物移动已完成
SELECT SINGLE vbeln, wadat_ist, wbstk
  FROM likp
  INTO @DATA(ls_likp)
  WHERE vbeln = @p_delivery.

IF ls_likp-wbstk <> 'C'.
  MESSAGE '交货单尚未完成发货过账' TYPE 'E'.
ENDIF.

" 2) 物料凭证：移动类型 601 = 发货给客户
SELECT mblnr, mjahr, matnr, menge, dmbtr
  FROM mseg
  INTO TABLE @DATA(lt_mseg)
  WHERE vbeln_im = @p_delivery
    AND bwart    = '601'.

" 3) 会计凭证：销售成本在这里结转
SELECT SINGLE belnr, bukrs, budat
  FROM bkpf
  INTO @DATA(ls_bkpf)
  WHERE awtyp = 'MKPF'
    AND awkey = @( ls_mseg[ 1 ]-mblnr && ls_mseg[ 1 ]-mjahr ).`,
    notes: [
      '这一步的价值在于：任何一环缺失都能定位到具体是库存、还是 FI 过账没成。',
      '过账期间未打开是最常见的失败原因，报错信息往往只说「期间」不说哪个月。',
    ],
  },
  {
    id: 'snip.delivery-create',
    lang: 'abap',
    title: '沿凭证流追溯订单 → 交货 → 发票',
    body: `" VBFA 是整条 O2C 链的骨架：每一跳派生关系存一行

" 第一跳：订单行 -> 交货单
SELECT vbeln, posnr, vbelv, posnv, vbtyp_n, rfmng
  FROM vbfa
  INTO TABLE @DATA(lt_delivery)
  WHERE vbelv   = @p_order        " 前序单据 = 销售订单
    AND posnv   = @p_item
    AND vbtyp_n = 'J'.            " J = 出库交货

" 第二跳：交货行 -> 发票
SELECT vbeln, posnr, vbelv, posnv, vbtyp_n
  FROM vbfa
  INTO TABLE @DATA(lt_invoice)
  FOR ALL ENTRIES IN @lt_delivery
  WHERE vbelv   = @lt_delivery-vbeln
    AND vbtyp_n = 'M'.            " M = 开票凭证

cl_demo_output=>write( lt_delivery ).
cl_demo_output=>write( lt_invoice ).
cl_demo_output=>display( ).`,
    notes: [
      '不用 VBFA 也能靠 VBELN 猜，但一旦遇到拆单、部分交货就会错。',
      'RFMNG 是已参照数量，用它判断「这行还剩多少没交货」。',
    ],
  },
  {
    id: 'snip.billing-create',
    lang: 'abap',
    title: '开票结果的校验与财务关联',
    body: `" 发票创建后必查三件事：状态、金额、是否已生成 FI 凭证

SELECT SINGLE vbeln, fkart, fkdat, netwr, waerk,
              kunrg, belnr, bukrs
  FROM vbrk
  INTO @DATA(ls_vbrk)
  WHERE vbeln = @p_invoice.

IF sy-subrc <> 0.
  MESSAGE '发票不存在' TYPE 'E'.
ENDIF.

" 开票数量来自实际发货量，不是订单量
SELECT posnr, matnr, fkimg, netwr
  FROM vbrp
  INTO TABLE @DATA(lt_vbrp)
  WHERE vbeln = @p_invoice.

" belnr 为空 = 尚未生成会计凭证，收入还没进账
IF ls_vbrk-belnr IS INITIAL.
  MESSAGE '发票尚未过账到 FI' TYPE 'W'.
ENDIF.`,
    notes: [
      'FKDAT 决定 FI 过账期间，跨月开票会改写上月收入，批量作业务必显式传日期。',
      '贷项凭证（G2/L2）金额为负，汇总报表要统一口径。',
    ],
  },
  {
    id: 'snip.badi-sd-sales',
    lang: 'abap',
    title: 'BAdI 实现：保存前校验 + 保存后落日志',
    body: `CLASS zcl_badi_sd_sales DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    INTERFACES if_ex_badi_sd_sales.
ENDCLASS.

CLASS zcl_badi_sd_sales IMPLEMENTATION.

  METHOD if_ex_badi_sd_sales~save_document_prepare.
    " 保存前最后一道校验：没有请求交货日期的订单直接拒
    IF vbak-vbeln IS NOT INITIAL AND vbak-vdatu IS INITIAL.
      MESSAGE '订单必须维护请求交货日期' TYPE 'E'.
    ENDIF.
  ENDMETHOD.

  METHOD if_ex_badi_sd_sales~after_save.
    " 注意：此处写库不与订单同一 LUW 提交
    INSERT zt_sd_order_log FROM @( VALUE #(
      vbeln = vbak-vbeln
      uname = sy-uname
      datum = sy-datum ) ).
    IF sy-subrc <> 0.
      " 记录失败不能回滚订单，只能留痕等补偿
      EXPORT msg = 'log failed' TO MEMORY ID 'ZSDLOG'.
    ENDIF.
  ENDMETHOD.

ENDCLASS.`,
    notes: [
      '方法签名请以 SE19/SE18 里系统给出的接口为准，不同版本参数略有差异。',
      '不要把耗时逻辑放在保存链路上 —— 用户会直接感受到卡顿。',
    ],
  },
  {
    id: 'snip.userexit-vbak',
    lang: 'abap',
    title: 'User Exit：把自定义字段带进抬头',
    body: `" 事务码 CMOD 增强 V45A0001 → INCLUDE MV45AFZZ
FORM userexit_move_field_to_vbak.

  " 屏幕字段 -> 抬头工作区
  IF vbak-zz_channel IS INITIAL.
    vbak-zz_channel = xvbak-zz_channel.
  ENDIF.

  " 关键：改了 VBAK 必须置 XVBAK 更新标记，否则不会落库
  IF vbak-zz_channel IS NOT INITIAL.
    xvbak-zz_channel = abap_true.
  ENDIF.

ENDFORM.`,
    notes: [
      '「代码写了但字段没进表」99% 是忘了置 XVBAK 标记。',
      'User Exit 属于隐式增强，S/4HANA 升级后可能失效；新开发优先用 BAdI。',
    ],
  },
  {
    id: 'snip.acc-doc-post',
    lang: 'abap',
    title: '用 BAPI 过账收款凭证',
    body: `DATA: ls_doc    TYPE bapiache09,
      lt_ar     TYPE TABLE OF bapiacar09,
      lt_amt    TYPE TABLE OF bapiaccr09,
      lt_return TYPE TABLE OF bapiret2,
      ls_ar     TYPE bapiacar09,
      ls_amt    TYPE bapiaccr09.

ls_doc-username   = sy-uname.
ls_doc-comp_code  = '1000'.
ls_doc-doc_type   = 'DZ'.          " 客户收款
ls_doc-pstng_date = sy-datum.
ls_doc-doc_date   = sy-datum.
ls_doc-header_txt = '收款清账'.

" 借方：银行存款
ls_amt-itemno_acc  = '1'.
ls_amt-currency    = 'CNY'.
ls_amt-amt_doccur  = 1000.         " 正数 = 借方
APPEND ls_amt TO lt_amt.

" 贷方：客户应收，负数表示贷方
ls_ar-itemno_acc = '2'.
ls_ar-customer   = '0000001000'.
APPEND ls_ar TO lt_ar.

CLEAR ls_amt.
ls_amt-itemno_acc = '2'.
ls_amt-currency   = 'CNY'.
ls_amt-amt_doccur = -1000.
APPEND ls_amt TO lt_amt.

CALL FUNCTION 'BAPI_ACC_DOCUMENT_POST'
  EXPORTING
    documentheader = ls_doc
  TABLES
    accountar      = lt_ar
    currencyamount = lt_amt
    return         = lt_return.

IF NOT line_exists( lt_return[ type = 'E' ] ).
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING
      wait = abap_true.
ENDIF.`,
    notes: [
      '正借负贷是这套 BAPI 的通用约定，借贷必须严格配平，不会部分过账。',
      '要清账还需通过 OBJ_TYPE / OBJ_KEY 指向具体的未清项，否则只是挂了一笔新账。',
    ],
  },
  {
    id: 'snip.odata-get',
    lang: 'http',
    title: '用 OData 查询销售订单',
    body: `GET /sap/opu/odata/sap/API_SALES_ORDER_SRV/A_SalesOrder
    ?$select=SalesOrder,SalesOrderType,SoldToParty,TotalNetAmount,CreationDate
    &$filter=SalesOrderType eq 'OR' and CreationDate ge datetime'2026-01-01T00:00:00'
    &$expand=to_Item($select=SalesOrderItem,Material,RequestedQuantity)
    &$top=20
    &$format=json
Accept: application/json
Authorization: Bearer <token>`,
    notes: [
      '写操作前先 GET 一次并带 x-csrf-token: fetch，拿到 token 与 Cookie 后在 POST 里复用。',
      '不写 $top 会被服务端默认上限截断，看起来像「数据不全」。',
      '大数据量别用 OData 翻页硬拉，改用 CDS 抽取或复制工具。',
    ],
  },
]

export const snippetById = Object.fromEntries(snippets.map((s) => [s.id, s]))
