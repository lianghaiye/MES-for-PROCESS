/**
 * 领料单打印预览：与采购申请/出库单同款 sessionStorage + 新窗口预览
 */
import { outboundState } from '@/store/outboundStore'

const STORAGE_PREFIX = 'material-requisition-print-preview:'

function formatPrintFieldValue(value) {
  if (value === 0) return '0'
  return String(value ?? '').trim()
}

function formatPrintQty(val) {
  if (val == null || val === '') return ''
  const n = Number(val)
  if (!Number.isFinite(n)) return String(val)
  if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n))
  return String(Math.round(n * 10000) / 10000)
}

function formatQtyWithUnit(qty, unit) {
  const text = formatPrintQty(qty)
  if (!text) return ''
  const unitText = formatPrintFieldValue(unit)
  return unitText ? `${text} ${unitText}` : text
}

function listLinkedOutbounds(record) {
  const ids = new Set((record.outboundOrders || []).map((order) => order.id).filter(Boolean))
  if (record.outboundId) ids.add(record.outboundId)
  return (outboundState.orders || []).filter(
    (order) => ids.has(order.id) || (record.id && order.materialReqId === record.id),
  )
}

function lineMatchesItem(item, line) {
  const code = item.itemCode || item.productCode || ''
  if (line.itemCode && code && code !== line.itemCode) return false
  if (line.itemId && item.itemId && line.itemId !== item.itemId) return false
  return true
}

function isIssuedItem(item) {
  if (item.lineStatus === '已拒绝') return false
  if ((item.batchAllocations || []).some((row) => row?.batchNo || row?.qty)) return true
  if (item.issuedBatchNo || item.pickedBatchNo) return true
  return item.lineStatus === '已出库'
}

/** 已出库的批次各占一行；尚未出库则保留申请行，实领数量留空。 */
function expandIssuedRows(line, outbounds) {
  const rows = []
  outbounds.forEach((order) => {
    ;(order.lineItems || []).forEach((item) => {
      if (!lineMatchesItem(item, line) || !isIssuedItem(item)) return
      const unit = item.unit || line.unit
      const allocations = (item.batchAllocations || []).filter((row) => row?.batchNo || row?.qty)
      if (allocations.length) {
        allocations.forEach((row) => {
          rows.push({
            batchNo: row.batchNo || '',
            qty: row.qty,
            unit,
          })
        })
        return
      }
      const parts = String(item.issuedBatchNo || item.pickedBatchNo || '')
        .split(/[、,，]/)
        .map((text) => text.trim())
        .filter(Boolean)
      if (parts.length > 1) {
        parts.forEach((batchNo) => rows.push({ batchNo, qty: null, unit }))
        return
      }
      rows.push({
        batchNo: parts[0] || '',
        qty: item.pickedLength ?? item.shipQty,
        unit,
      })
    })
  })
  return rows
}

function buildPrintLines(record) {
  const outbounds = listLinkedOutbounds(record)
  const rows = []
  ;(record.lines || []).forEach((line) => {
    const unit = line.unit
    const requestQty = formatQtyWithUnit(line.shipQty ?? line.planQty ?? line.qty, unit)
    const issued = expandIssuedRows(line, outbounds)
    const base = {
      itemCode: formatPrintFieldValue(line.itemCode || line.materialCode),
      itemName: formatPrintFieldValue(line.itemName || line.materialName),
      requestQty,
      shipWarehouse: formatPrintFieldValue(line.shipWarehouse || line.warehouse),
    }
    if (!issued.length) {
      rows.push({ ...base, issuedQty: '', issuedBatch: '' })
      return
    }
    issued.forEach((row) => {
      rows.push({
        ...base,
        issuedQty: formatQtyWithUnit(row.qty, row.unit || unit),
        issuedBatch: formatPrintFieldValue(row.batchNo),
      })
    })
  })
  return rows.map((row, index) => ({ ...row, seq: index + 1 }))
}

/** 构建单张领料单打印数据（含明细） */
export function buildMaterialRequisitionPrintPayload(record, options = {}) {
  if (!record) return null

  const lineItems = buildPrintLines(record)

  const basicFields = [
    { label: '批次指令', value: record.workOrderCode },
    { label: '申请车间', value: record.workshop },
    { label: '领入仓库', value: record.receiveWarehouse },
    { label: '出库单号', value: record.outboundDocNo },
    { label: '申请人', value: record.applicant },
    { label: '申请时间', value: record.createdAt },
    { label: '备注', value: record.remark, wide: true },
  ].map((field) => ({
    ...field,
    value: formatPrintFieldValue(field.value === '—' ? '' : field.value),
  }))

  const totalShipQty = (record.lines || []).reduce(
    (s, l) => s + (Number(l.shipQty ?? l.planQty ?? l.qty) || 0),
    0,
  )
  const totalIssuedQty = lineItems.reduce((sum, row) => {
    const matched = String(row.issuedQty || '').match(/-?\d+(\.\d+)?/)
    return sum + (matched ? Number(matched[0]) : 0)
  }, 0)

  return {
    reqNo: formatPrintFieldValue(record.reqNo),
    title: '领料单',
    basicFields,
    lineItems,
    summary: {
      lineCount: String(lineItems.length),
      totalShipQty: formatPrintQty(totalShipQty || record.totalQty),
      totalIssuedQty: totalIssuedQty ? formatPrintQty(totalIssuedQty) : '',
    },
    paper: options.paper || 'A4',
    orientation: options.orientation || 'portrait',
    printedAt: new Date().toISOString(),
  }
}

export function buildMaterialRequisitionBatchPrintPayload(records, options = {}) {
  const sheets = (records || [])
    .map((row) => buildMaterialRequisitionPrintPayload(row, options))
    .filter(Boolean)
  if (!sheets.length) return null
  return {
    sheets,
    paper: options.paper || 'A4',
    orientation: options.orientation || 'portrait',
    printedAt: new Date().toISOString(),
  }
}

export function saveMaterialRequisitionPrintPayload(payload) {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(payload))
  return key
}

export function loadMaterialRequisitionPrintPayload(key) {
  if (!key) return null
  const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function openMaterialRequisitionPrintPreview(router, payload, { autoPrint = false } = {}) {
  const key = saveMaterialRequisitionPrintPayload(payload)
  const query = { key }
  if (autoPrint) query.autoPrint = '1'
  const { href } = router.resolve({ name: 'production-material-requisition-preview', query })
  window.open(href, '_blank')
}
