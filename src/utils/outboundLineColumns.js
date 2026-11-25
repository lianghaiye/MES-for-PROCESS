/** 出库明细列定义（新增/编辑表单与详情页共用） */
import { formatContentPctText } from '@/utils/batchContent'

/** 仅销售出库展示的明细列 */
export const OUTBOUND_SALES_ONLY_LINE_KEYS = ['packagingForm', 'deliveryRemark']

/** 销售出库不再单独隐藏离散列 */
export const OUTBOUND_NON_SALES_LINE_KEYS = []

export const outboundFormLineColumns = [
  { title: '序号', key: 'index', width: 56, align: 'center' },
  { title: '状态', key: 'lineStatus', dataIndex: 'lineStatus', width: 88 },
  { title: '物品名称', dataIndex: 'itemName', key: 'itemName', width: 130, ellipsis: true },
  { title: '物品编码', dataIndex: 'itemCode', key: 'itemCode', width: 120, ellipsis: true },
  { title: '规格型号', dataIndex: 'specModel', key: 'specModel', width: 110, ellipsis: true },
  { title: '条码类型', dataIndex: 'barcodeType', key: 'barcodeType', width: 96 },
  { title: '当前可用库存数', key: 'availableStockQty', width: 130, align: 'right' },
  { title: '当前仓库数量', key: 'warehouseStockQty', width: 130, align: 'right' },
  { title: '出库位置', key: 'shipWarehouse', width: 120 },
  { title: '货位号', key: 'locationNo', dataIndex: 'locationNo', width: 110, ellipsis: true },
  /** 数量与单位合并展示，如「10 米」 */
  { title: '出库数量', key: 'shipQty', width: 120 },
  { title: '出库重量(kg)', key: 'weight', width: 120, align: 'right' },
  { title: '拣选批次', key: 'batchPick', width: 260 },
  { title: '有效含量', key: 'content', width: 110, align: 'right' },
  {
    title: '包装形式',
    dataIndex: 'packagingForm',
    key: 'packagingForm',
    width: 96,
    ellipsis: true,
  },
  { title: '发货备注', key: 'deliveryRemark', width: 140, ellipsis: true },
  { title: '单价', key: 'unitPrice', width: 96, align: 'right' },
  { title: '总价', key: 'totalPrice', width: 96, align: 'right' },
  { title: '操作', key: 'actions', width: 200 },
]

/** 详情页不展示实时库存；拣选批次改为出库实扣批次 */
export const OUTBOUND_DETAIL_HIDDEN_LINE_KEYS = [
  'actions',
  'availableStockQty',
  'warehouseStockQty',
]

export const outboundDetailLineColumns = outboundFormLineColumns.filter(
  (c) => !OUTBOUND_DETAIL_HIDDEN_LINE_KEYS.includes(c.key),
)

/** 按出库类型过滤明细列（非销售出库隐藏包装形式、发货备注） */
export function filterOutboundLineColumns(columns, outboundType) {
  const list = Array.isArray(columns) ? columns : []
  if (outboundType === '销售出库') {
    return list.filter((c) => !OUTBOUND_NON_SALES_LINE_KEYS.includes(c.key))
  }
  return list.filter((c) => !OUTBOUND_SALES_ONLY_LINE_KEYS.includes(c.key))
}

/** 拣选批次列提示 */
export const OUTBOUND_BATCH_PICK_TIP_MANUAL =
  '自主选批：先填写出库数量，再多选批次（或点「搜索更多」）。系统按所选批次「余量小优先」跨批扣减；出库数量大于所选批次合计时拦截。允许跨批次扣减；有效含量跟所选批次走。'

export const OUTBOUND_BATCH_PICK_TIP_AUTO =
  '默认 FEFO（近效先出）：失效日期近的先扣，同效期再按批次号先进先出；需下料结算物料叠加余料优先/最短够用。功能参数为「两者皆可」时可点「自主拣选」改实发批；含量跟过账批次走。'

/** @deprecated 兼容旧引用，等同自主拣选提示 */
export const OUTBOUND_BATCH_PICK_TIP = OUTBOUND_BATCH_PICK_TIP_MANUAL

const BATCH_ATTR_LABELS = {
  specModel: '规格型号',
  content: '有效含量',
  expiryDate: '失效日期',
  supplierBatchNo: '供应商批号',
}

const BATCH_ATTR_SKIP = new Set([
  'inboundEntryMode',
  'processStatus',
  'material',
  'length',
  'weight',
])

/** 批次 attrs 展示文案（确认出库回写等仍可用） */
export function formatBatchAttrsText(attrs) {
  if (!attrs || typeof attrs !== 'object') return ''
  const parts = []
  Object.entries(attrs).forEach(([key, val]) => {
    if (val == null || val === '') return
    if (BATCH_ATTR_SKIP.has(key)) return
    const label = BATCH_ATTR_LABELS[key] || key
    if (key === 'content') {
      const text = formatContentPctText(val)
      if (text !== '—') parts.push(`${label}:${text}`)
      return
    }
    parts.push(`${label}:${val}`)
  })
  return parts.join('；')
}
