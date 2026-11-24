import { cell } from './exportFieldHelpers'

/** 领料申请导出（含申请领取的物料明细与数量，一行一物料） */
export const materialRequisitionExportFields = [
  { key: 'reqNo', title: '申请单号', getValue: (row) => cell(row, 'reqNo') },
  { key: 'auditStatus', title: '申请状态', getValue: (row) => cell(row, 'auditStatus') },
  { key: 'modeLabel', title: '领料方式', getValue: (row) => cell(row, 'modeLabel') },
  { key: 'workOrderText', title: '批次指令', getValue: (row) => cell(row, 'workOrderText') },
  { key: 'productText', title: '产品/摘要', getValue: (row) => cell(row, 'productText') },
  { key: 'workshop', title: '申请车间', getValue: (row) => cell(row, 'workshop') },
  { key: 'receiveWarehouse', title: '领入仓库', getValue: (row) => cell(row, 'receiveWarehouse') },
  { key: 'outboundDocNo', title: '出库单号', getValue: (row) => cell(row, 'outboundDocNo') },
  { key: 'outboundStatus', title: '出库状态', getValue: (row) => cell(row, 'outboundStatus') },
  { key: 'applicant', title: '申请人', getValue: (row) => cell(row, 'applicant') },
  { key: 'createdAt', title: '申请时间', getValue: (row) => cell(row, 'createdAt') },
  { key: 'itemCode', title: '物料编码', getValue: (row) => cell(row, 'itemCode') },
  { key: 'itemName', title: '物料名称', getValue: (row) => cell(row, 'itemName') },
  { key: 'shipQty', title: '领料数量', getValue: (row) => cell(row, 'shipQty') },
  { key: 'unit', title: '单位', getValue: (row) => cell(row, 'unit') },
  { key: 'shipWarehouse', title: '领料仓库', getValue: (row) => cell(row, 'shipWarehouse') },
  { key: 'issuedBatch', title: '已领批次', getValue: (row) => cell(row, 'issuedBatch') },
]

export function flattenMaterialRequisitionRows(records = [], helpers = {}) {
  const { relatedWorkOrderText, relatedProductText } = helpers
  const rows = []
  records.forEach((r) => {
    const workOrderText = relatedWorkOrderText ? relatedWorkOrderText(r) : r.workOrderCode || ''
    const productText = relatedProductText ? relatedProductText(r) : r.productName || ''
    const lines = r.lines || []
    if (!lines.length) {
      rows.push({
        reqNo: r.reqNo,
        auditStatus: r.auditStatus,
        modeLabel: r.modeLabel,
        workOrderText,
        productText,
        workshop: r.workshop,
        receiveWarehouse: r.receiveWarehouse || '',
        outboundDocNo: r.outboundDocNo || '',
        outboundStatus: r.outboundStatus || '',
        applicant: r.applicant,
        createdAt: r.createdAt,
        itemCode: '',
        itemName: '',
        shipQty: '',
        unit: '',
        shipWarehouse: '',
        issuedBatch: '',
      })
      return
    }
    lines.forEach((l) => {
      rows.push({
        reqNo: r.reqNo,
        auditStatus: r.auditStatus,
        modeLabel: r.modeLabel,
        workOrderText,
        productText,
        workshop: r.workshop,
        receiveWarehouse: r.receiveWarehouse || '',
        outboundDocNo: r.outboundDocNo || '',
        outboundStatus: r.outboundStatus || '',
        applicant: r.applicant,
        createdAt: r.createdAt,
        itemCode: l.itemCode || '',
        itemName: l.itemName || '',
        shipQty: l.shipQty ?? '',
        unit: l.unit || '',
        shipWarehouse: l.shipWarehouse || '',
        issuedBatch: l.issuedBatchNo || l.issuedBatch || '',
      })
    })
  })
  return rows
}
