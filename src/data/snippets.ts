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
  {
    id: 'snip.po-create',
    lang: 'abap',
    title: '用 BAPI 创建采购订单',
    body: `DATA: ls_header  TYPE bapimepoheader,
      ls_headerx TYPE bapimepoheaderx,
      ls_item    TYPE bapimepoitem,
      ls_itemx   TYPE bapimepoitemx,
      ls_account TYPE bapimepoaccount,
      lt_items   TYPE TABLE OF bapimepoitem,
      lt_itemsx  TYPE TABLE OF bapimepoitemx,
      lt_return  TYPE TABLE OF bapiret2,
      lv_po      TYPE bapimepoheader-po_number.

ls_header-comp_code   = '1000'.
ls_header-vendor      = '0000100234'.
ls_header-purch_org   = '1000'.
ls_header-pur_group   = '001'.
ls_header-doc_type    = 'NB'.
ls_headerx-comp_code  = abap_true.
ls_headerx-vendor     = abap_true.
ls_headerx-purch_org  = abap_true.
ls_headerx-pur_group  = abap_true.
ls_headerx-doc_type   = abap_true.

ls_item-plant      = '1000'.
ls_item-material   = 'MAT-1001'.
ls_item-quantity   = 100.
ls_item-po_unit    = 'PC'.
ls_item-net_price  = '12.50'.
ls_item-item_cat   = '0'.        " 0 = 标准（库存采购）
ls_item-acctasscat = ''.         " 库存采购必须为空，K 类才填
ls_itemx-plant      = abap_true.
ls_itemx-material   = abap_true.
ls_itemx-quantity   = abap_true.
ls_itemx-po_unit    = abap_true.
ls_itemx-net_price  = abap_true.
ls_itemx-item_cat   = abap_true.
APPEND ls_item  TO lt_items.
APPEND ls_itemx TO lt_itemsx.

CALL FUNCTION 'BAPI_PO_CREATE1'
  EXPORTING
    poheader  = ls_header
    poheaderx = ls_headerx
  IMPORTING
    exppurchaseorder = lv_po
  TABLES
    return    = lt_return
    poitem    = lt_items
    poitemx   = lt_itemsx.

" 必须自己判错 + 自己提交，缺一不可
READ TABLE lt_return TRANSPORTING NO FIELDS
  WITH KEY type = 'E'.
IF sy-subrc = 0.
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING wait = abap_true.
ENDIF.`,
    notes: [
      '所有 X 结构必须与数据字段成对打标记，漏一个该字段就会被静默忽略 —— 这是本 BAPI 最高频的问题。',
      '库存采购（item_cat = 0）不能带科目分配；费用采购（K）必须带 POACCOUNT，且 acctasscat 不能为空。',
      'BAPI 不提交事务，必须显式 COMMIT；失败时用 ROLLBACK，否则会留下编号空洞。',
    ],
  },
  {
    id: 'snip.gr-post',
    lang: 'abap',
    title: '按采购订单收货过账',
    body: `DATA: ls_header TYPE bapi2017_gm_head_01,
      ls_code   TYPE bapi2017_gm_code,
      ls_item   TYPE bapi2017_gm_item_create,
      lt_items  TYPE TABLE OF bapi2017_gm_item_create,
      lt_return TYPE TABLE OF bapiret2,
      lv_mblnr  TYPE bapi2017_gm_head_ret-mat_doc,
      lv_year   TYPE bapi2017_gm_head_ret-doc_year.

ls_code-gm_code = '01'.          " 01 = 收货
ls_header-pstng_date = sy-datum.
ls_header-doc_date   = sy-datum.
ls_header-ref_doc_no = 'GR-2026-0042'.

ls_item-material    = 'MAT-1001'.
ls_item-plant       = '1000'.
ls_item-stge_loc    = '0001'.
ls_item-move_type   = '101'.     " 必须与 gm_code 01 匹配
ls_item-entry_qnt   = 100.
ls_item-entry_uom   = 'PC'.
ls_item-po_number   = '4500001234'.
ls_item-po_item     = '00010'.
ls_item-item_text   = '按 PO 收货'.
APPEND ls_item TO lt_items.

CALL FUNCTION 'BAPI_GOODSMVT_CREATE'
  EXPORTING
    goodsmvt_header  = ls_header
    goodsmvt_code    = ls_code
  IMPORTING
    goodsmvt_headret = DATA(ls_ret)
  TABLES
    goodsmvt_item    = lt_items
    return           = lt_return.

" BAPI 对业务错误常返回空 return，必须再看凭证号
IF ls_ret-mat_doc IS INITIAL.
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING wait = abap_true.
ENDIF.`,
    notes: [
      'gm_code 与移动类型必须匹配（01↔101、03↔261、04↔311），配错不报错但会过出语义错误的凭证。',
      '判断成功不要只看 RETURN，业务错误时 RETURN 可能为空 —— 要同时校验 MAT_DOC 是否为空。',
      '序列号管理物料必须填 GOODSMVT_SERIALNUMBER，漏填会生成部分行，需先冲销再重做。',
    ],
  },
  {
    id: 'snip.iv-post',
    lang: 'abap',
    title: '创建供应商发票（三单匹配）',
    body: `DATA: ls_header TYPE bapi_incinv_headers,
      ls_item   TYPE bapi_incinv_create_item,
      lt_items  TYPE TABLE OF bapi_incinv_create_item,
      lt_return TYPE TABLE OF bapiret2,
      lv_inv    TYPE bapi_incinv_fld-inv_doc_no.

ls_header-invoice_ind  = 'X'.      " 做发票校验（非贷项）
ls_header-doc_type     = 'RE'.
ls_header-doc_date     = sy-datum.
ls_header-pstng_date   = sy-datum.
ls_header-comp_code    = '1000'.
ls_header-vendor_no    = '0000100234'.
ls_header-currency     = 'CNY'.
ls_header-calc_tax_ind = 'X'.      " 由系统按税码算税

ls_item-invoice_item   = '000001'.
ls_item-po_number      = '4500001234'.
ls_item-po_item        = '00010'.
ls_item-item_amount    = '1250.00'.
ls_item-quantity       = 100.
ls_item-po_unit        = 'PC'.
ls_item-tax_code       = 'J1'.
ls_item-taxjurcode     = '00'.
APPEND ls_item TO lt_items.

CALL FUNCTION 'BAPI_INCOMINGINVOICE_CREATE'
  EXPORTING
    headerdata       = ls_header
    calc_tax_ind     = 'X'
  IMPORTING
    invoicedocnumber = lv_inv
  TABLES
    itemdata         = lt_items
    return           = lt_return.

" 关键：区分「建成」与「建成但冻结」
LOOP AT lt_return INTO DATA(ls_ret)
     WHERE type CA 'EAW'.
  WRITE: / ls_ret-type, ls_ret-message.
ENDLOOP.`,
    notes: [
      '超出容差时 BAPI 返回 W 而非 E，发票「建成但被冻结」—— 只判 E 会漏掉，生产事故多出于此。',
      '开 calc_tax_ind 才能让系统按税码算税；否则必须自己把税额算准传进来。',
      '发票冻结后要用 BAPI_INCOMINGINVOICE_RELEASE 释放，不是改字段。',
    ],
  },
  {
    id: 'snip.po-badi',
    lang: 'abap',
    title: 'ME_PROCESS_PO_CUST：PO 行项目校验',
    body: `METHOD if_ex_me_process_po_cust~check.
  DATA: lo_item TYPE REF TO if_purchase_order_item_mm.

  " 只处理标准行项目，避免影响服务/限价类项目
  lo_item = im_item.
  IF lo_item->get_data( )-item_cat <> '0'.
    RETURN.
  ENDIF.

  DATA(ls_data) = lo_item->get_data( ).

  " 业务规则：单行金额超过 50 万必须走审批
  IF ls_data-net_value > 500000.
    " 必须用带消息的异常，直接 RETURN 不会阻止保存
    mo_message->add_message(
      exporting
        msgty = 'E'
        msgid = 'ZMM'
        msgno = '001'
        msgv1 = ls_data-po_number
        msgv2 = ls_data-po_item ).
  ENDIF.
ENDMETHOD.`,
    notes: [
      'CHECK 方法里阻止保存必须用 MESSAGE/异常，RETURN 只是跳过逻辑，单据照样能存。',
      '不要在 POST 方法里再调 BAPI 建同类单据，会递归触发增强。',
      'im_item 是对象引用，改值要用 setter 并最后 commit，直接改结构不生效。',
    ],
  },
  {
    id: 'snip.migo-badi',
    lang: 'abap',
    title: 'MB_MIGO_BADI：收货行项目校验',
    body: `METHOD if_ex_mb_migo_badi~check_item.
  " is_goitem 是 MIGO 的行项目结构，字段极多
  IF is_goitem-bwart <> '101'.
    RETURN.
  ENDIF.

  " 业务规则：质检物料必须放到质检库存地点 0002
  SELECT SINGLE lgort FROM mard
    INTO @DATA(lv_dummy)
    WHERE matnr = @is_goitem-matnr
      AND werks = @is_goitem-werks
      AND lgort = '0002'.

  IF is_goitem-lgort <> '0002'
     AND is_goitem-pruefart IS NOT INITIAL.
    e_message = '质检物料必须收到质检库存地点 0002'.  " 返回消息即可阻止
  ENDIF.
ENDMETHOD.`,
    notes: [
      'CHECK_ITEM 通过导出参数 E_MESSAGE 返回错误即可阻止过账，不需要抛异常。',
      '这个 BAdI 只在 MIGO 事务内触发；老程序走 MB_CREATE_GOODS_MOVEMENT 不经过它。',
      '不要在 POST_DOCUMENT 里 COMMIT WORK，会导致凭证号跳号。',
    ],
  },
  {
    id: 'snip.planned-order',
    lang: 'abap',
    title: '创建计划订单（带组件）',
    body: `DATA: ls_head TYPE bapiplaf_i1,
      ls_item TYPE bapiplaf_i2,
      lt_item TYPE TABLE OF bapiplaf_i2,
      lt_ret  TYPE TABLE OF bapiret2,
      lv_pln  TYPE bapiplaf_e1-plannedorder.

ls_head-material   = 'FG-2001'.
ls_head-plant      = '1000'.
ls_head-quantity   = 500.
ls_head-prod_vers  = '0001'.

" 组件必须自己展开或显式传入，BAPI 不会替你跑 BOM
ls_item-material   = 'RM-1001'.
ls_item-plant      = '1000'.
ls_item-entry_qnt  = 1000.
APPEND ls_item TO lt_item.

CALL FUNCTION 'BAPI_PLANNEDORDER_CREATE'
  IMPORTING
    plannedorder = lv_pln
  TABLES
    plannedorder_head = ls_head
    plannedorder_item = lt_item
    return            = lt_ret.

IF lv_pln IS INITIAL.
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING wait = abap_true.
ENDIF.`,
    notes: [
      '不传组件时系统不会展开 BOM，后续转换出的生产订单会缺料。',
      '日期与提前期冲突时只给警告，计划订单可能被排到过去。',
    ],
  },
  {
    id: 'snip.prodord-create',
    lang: 'abap',
    title: '创建生产订单并带回工序与组件',
    body: `DATA: ls_order TYPE bapi_pp_order_create,
      lt_ret   TYPE TABLE OF bapiret2,
      lv_aufnr TYPE bapi_order_key-order_number.

ls_order-material   = 'FG-2001'.
ls_order-plant      = '1000'.
ls_order-order_type = 'PP01'.
ls_order-quantity   = 500.
ls_order-basic_start_date = sy-datum + 3.
ls_order-basic_end_date   = sy-datum + 10.

CALL FUNCTION 'BAPI_PRODORD_CREATE'
  EXPORTING
    orderdata     = ls_order
  IMPORTING
    order_number  = lv_aufnr
  TABLES
    return        = lt_ret.

" 建成 ≠ 建成对了：缺 BOM/工艺路线时只给警告
IF lv_aufnr IS INITIAL.
  CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
ELSE.
  CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
    EXPORTING wait = abap_true.
ENDIF.`,
    notes: [
      '订单类型决定结算规则与字段状态，不传时按物料主数据推导，推不出来会建成空单。',
      '创建阶段不做可用性拦截，缺料要到下达时才报错。',
    ],
  },
  {
    id: 'snip.prodord-release',
    lang: 'abap',
    title: '批量下达生产订单',
    body: `DATA: lt_numbers TYPE TABLE OF bapi_order_key,
      lt_detail  TYPE TABLE OF bapi_order_status,
      lt_ret     TYPE TABLE OF bapiret2,
      ls_key     LIKE LINE OF lt_numbers.

ls_key-order_number = '1000023456'.
APPEND ls_key TO lt_numbers.
APPEND ls_key TO lt_numbers.

CALL FUNCTION 'BAPI_PRODORD_RELEASE'
  TABLES
    orders        = lt_numbers
    detail_return = lt_detail
    return        = lt_ret.

" 部分成功是常态：逐条判断，不能只看整体返回
LOOP AT lt_detail INTO DATA(ls_d).
  IF ls_d-objstatus IS NOT INITIAL.   " 已释放
    WRITE: / 'OK  ', ls_d-order_number.
  ELSE.
    WRITE: / 'FAIL', ls_d-order_number.
  ENDIF.
ENDLOOP.

CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
  EXPORTING wait = abap_true.`,
    notes: [
      '批量下达必须读 DETAIL_RETURN，整体 RETURN 只反映调用是否成功。',
      '缺料订单下达失败不会自动建采购申请，仍要回到 MRP 处理。',
      'COMMIT 要放在循环外，逐条提交会产生大量小事务。',
    ],
  },
  {
    id: 'snip.confirm',
    lang: 'abap',
    title: '工序确认（报工 + 倒冲）',
    body: `DATA: ls_ticket TYPE bapi_pp_timeticket,
      ls_gm     TYPE bapi_pp_goods_movement,
      lt_ticket TYPE TABLE OF bapi_pp_timeticket,
      lt_gm     TYPE TABLE OF bapi_pp_goods_movement,
      lt_ret    TYPE TABLE OF bapiret2.

ls_ticket-orderid          = '1000023456'.
ls_ticket-operation        = '0010'.
ls_ticket-yield            = 100.
ls_ticket-scrap            = 2.
ls_ticket-conf_act_work    = 480.      " 分钟，不是小时
ls_ticket-postg_date       = sy-datum.
ls_ticket-plant            = '1000'.
APPEND ls_ticket TO lt_ticket.

" 倒冲物料：只确认不传这里，库存就不会被扣
ls_gm-orderid   = '1000023456'.
ls_gm-operation = '0010'.
ls_gm-material  = 'RM-1001'.
ls_gm-plant     = '1000'.
ls_gm-quantity  = 200.                 " 负数表示消耗
ls_gm-batch     = 'B20261101'.
ls_gm-move_type = '261'.
APPEND ls_gm TO lt_gm.

CALL FUNCTION 'BAPI_PRODORDCONF_CREATE_TT'
  TABLES
    timetickets     = lt_ticket
    goodsmovements  = lt_gm
    return          = lt_ret.

CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
  EXPORTING wait = abap_true.`,
    notes: [
      '工时单位是分钟。传小时会让人工成本差 60 倍，而且不会报错。',
      '倒冲物料必须显式放进 GOODSMOVEMENTS，否则只确认不扣料，库存虚高。',
      '同一工序多次确认时要靠时间票做幂等，否则重复投递会重复报工。',
    ],
  },
]

export const snippetById = Object.fromEntries(snippets.map((s) => [s.id, s]))

