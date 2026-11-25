/** 入库明细列定义（新增/编辑表单与详情页共用） */

export const inboundFormLineColumns = [
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '状态', key: 'lineStatus', dataIndex: 'lineStatus', width: 88 },
  { title: '物品名称', dataIndex: 'itemName', key: 'itemName', width: 130, ellipsis: true },
  { title: '物品编码', dataIndex: 'itemCode', key: 'itemCode', width: 120, ellipsis: true },
  { title: '规格型号', dataIndex: 'specModel', key: 'specModel', width: 110, ellipsis: true },
  { title: '条码类型', dataIndex: 'barcodeType', key: 'barcodeType', width: 96 },
  /** 点收数量：有采购辅助单位时按采购单位；否则与入库数量同值 */
  { title: '点收数量', key: 'qty', width: 120 },
  /** 入库数量：按库存（主）单位入账 */
  { title: '入库数量', key: 'stockUnitQty', width: 130 },
  /** 有结算辅助单位时展示 */
  { title: '结算数量', key: 'settleQty', width: 150 },
  { title: '入库位置', key: 'warehouse', width: 140 },
  { title: '货位号', key: 'locationNo', dataIndex: 'locationNo', width: 110, ellipsis: true },
  { title: '有效含量(%)', key: 'content', width: 120, align: 'right' },
  { title: '入库成本价', key: 'unitPrice', width: 120, align: 'right' },
  { title: '总价', key: 'totalPrice', width: 96, align: 'right' },
  { title: '当前库存数', key: 'stockQty', width: 120, align: 'right' },
  { title: '当前仓库数量', key: 'warehouseStockQty', width: 130, align: 'right' },
  { title: '操作', key: 'actions', width: 200 },
]

export const inboundDetailLineColumns = inboundFormLineColumns.filter((c) => c.key !== 'actions')

/** 点收数量列提示 */
export const RECEIVE_QTY_TIP =
  '有采购辅助单位时按采购单位点收；无则与入库数量同值。库存入账以「入库数量」为准。'

/** 入库数量列提示文案（库存单位入账量） */
export const STOCK_UNIT_QTY_TIP =
  '按库存（主）单位填写的实际入账量。有采购辅助单位且配置了固定换算率时，可按点收数量预填，可改。'

/** 结算数量列提示 */
export const SETTLE_QTY_TIP =
  '仅当物料配置了结算辅助单位时填写本列合计。总价按结算数量 × 入库成本价。'

/** 入库成本价列提示 */
export const INBOUND_COST_PRICE_TIP =
  '无结算单位时：总价 = 入库成本价 × 入库数量。有结算单位时：总价 = 入库成本价 × 结算数量合计。'
