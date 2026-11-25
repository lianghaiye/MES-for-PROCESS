import { createInboundLine } from '@/mock/inboundOrders'
import { getOwnActiveBomForItem } from '@/store/productBomStore'
import { materialInfoState } from '@/store/materialInfoStore'
import { getStockQty, stockState } from '@/store/stockStore'
import { demoStockQty } from '@/utils/productionPlanWorkItem'
import {
  purchaseQtyToStockQty,
  resolveInventoryUnit,
  resolvePurchaseConvertRate,
  resolvePurchaseUnit,
} from '@/utils/purchaseUomConvert'
import { normalizeUnit } from '@/utils/unitCaliber'
import {
  applySettleFieldsFromMaterial,
  estimateSettleQty,
  hasSettleUnit,
  resolvePricingQty,
} from '@/utils/settleUnit'

function roundQty(val) {
  return Math.round((Number(val) || 0) * 1000) / 1000
}

function roundMoney(val) {
  return Math.round((Number(val) || 0) * 100) / 100
}

/** 结算数量录入方式（流程型仅合计） */
export const SETTLE_ENTRY_MODE = {
  UNIFORM: 'uniform',
  PIECE: 'piece',
  TOTAL: 'total',
}

export function findMaterialByCode(itemCode) {
  if (!itemCode) return null
  return materialInfoState.materials.find((m) => m.code === itemCode) || null
}

/**
 * 入库是否走「采购辅助单位」口径：采购单位 ≠ 库存单位。
 * 流程型已取消旧双单位按件填法；本判断只决定是否拆点收/入库两列。
 */
export function isInboundDualUnitLine(line = {}, material = null) {
  const mat = material || findMaterialByCode(line.itemCode)
  const inv = normalizeUnit(line.stockUnit || line.unit || resolveInventoryUnit(mat || {}))
  const pur = normalizeUnit(line.purchaseUnit || resolvePurchaseUnit(mat || {}))
  return Boolean(inv && pur && inv !== pur)
}

/** 点收数量单位（有采购辅助单位用采购单位，否则库存单位） */
export function resolveInboundQtyUnit(line = {}, material = null) {
  const mat = material || findMaterialByCode(line.itemCode)
  if (isInboundDualUnitLine(line, mat)) {
    return line.purchaseUnit || resolvePurchaseUnit(mat || {}) || '件'
  }
  return line.unit || resolveInventoryUnit(mat || {}) || '件'
}

/** 入库数量单位（库存 / 主单位） */
export function resolveInboundStockUnit(line = {}, material = null) {
  const mat = material || findMaterialByCode(line.itemCode)
  return line.stockUnit || line.unit || resolveInventoryUnit(mat || {}) || '件'
}

/** 点收数量：有采购辅助单位取 purchaseQty，否则同入库数量 */
export function getInboundQtyValue(line = {}) {
  if (isInboundDualUnitLine(line)) return line.purchaseQty
  return line.qty
}

/** 入库数量（库存单位合计）；不再按统一单件/逐件展开 */
export function getStockUnitQtyValue(line = {}) {
  if (!isInboundDualUnitLine(line)) return line.qty
  const v = line.qty
  return v == null || v === '' ? null : v
}

/** @deprecated 旧按件填法已移除；保留空实现避免列表引用报错 */
export function getUniformPieceValue() {
  return null
}

/**
 * 按物料档案写入采购/结算辅助单位字段。
 * 清除旧「怎么填」按件残留，固定换算率用于预填入库数量。
 */
export function applyDualUnitFieldsToInboundLine(line = {}, itemCode = '') {
  const code = itemCode || line.itemCode
  const mat = findMaterialByCode(code)
  if (!mat) {
    line.stockUnit = line.unit || '件'
    return line
  }
  const inv = resolveInventoryUnit(mat)
  const pur = resolvePurchaseUnit(mat)
  const dual = Boolean(inv && pur && normalizeUnit(inv) !== normalizeUnit(pur))
  const rate = resolvePurchaseConvertRate(mat)

  line.barcodeType = mat.barcodeType || line.barcodeType || '一批一码'
  line.stockUnit = inv
  line.unit = inv
  // 明确关闭旧双单位按件链路
  line.isVariableLength = false
  line.inboundEntryMode = undefined
  line.inboundMeasureMode = undefined
  line.uniformValue = undefined
  line.uniformLength = undefined
  line.uniformWidth = undefined
  line.totalValue = undefined
  line.pieceValues = undefined
  line.pieceLengths = undefined
  line.pieceWeights = undefined
  line.pieceDims = undefined

  if (dual) {
    line.purchaseUnit = pur
    line.purchaseConvertRate = rate
    line.packageContent = rate
    // 有换算率且已填点收、尚未填入库 → 预填库存数量
    if (rate != null && Number(line.purchaseQty) > 0 && !(Number(line.qty) > 0)) {
      line.qty = purchaseQtyToStockQty(line.purchaseQty, rate)
    }
  } else {
    line.purchaseUnit = inv
    line.purchaseQty = undefined
    line.purchaseConvertRate = undefined
    line.packageContent = undefined
  }

  applySettleFieldsFromMaterial(line, mat)
  if (hasSettleUnit(line)) {
    const baseQty = Number(line.purchaseQty ?? line.qty) || 0
    if (!(Number(line.settleQty) > 0)) {
      const est = estimateSettleQty(line, baseQty)
      if (est != null) line.settleQty = est
    }
    if (line.settledSettleQty == null) line.settledSettleQty = 0
    // 结算只保留合计填法
    line.settleEntryMode = SETTLE_ENTRY_MODE.TOTAL
  } else {
    line.settleQty = undefined
    line.settledSettleQty = undefined
  }
  return line
}

export function getSettleEntryModeOptions() {
  // 流程型仅合计；保留函数供旧引用
  return [{ label: '直接填合计', value: SETTLE_ENTRY_MODE.TOTAL }]
}

/** 结算一律按合计 */
export function resolveSettleEntryMode() {
  return SETTLE_ENTRY_MODE.TOTAL
}

/** @deprecated 按件结算已移除 */
export function resolveInboundPieceCount() {
  return 0
}

function roundSettleQty(val) {
  return Math.round((Number(val) || 0) * 10000) / 10000
}

/** 回写结算数量合计 */
export function materializeSettleQty(line = {}) {
  if (!hasSettleUnit(line)) return line.settleQty
  line.settleEntryMode = SETTLE_ENTRY_MODE.TOTAL
  return line.settleQty
}

/** 校验结算数量合计 */
export function validateSettleEntry(line = {}) {
  if (!hasSettleUnit(line)) return { ok: true }
  const unit = line.settleUnit || 'kg'
  line.settleEntryMode = SETTLE_ENTRY_MODE.TOTAL
  const total = Number(line.settleQty)
  if (!(total > 0)) return { ok: false, message: `请填写结算数量合计（${unit}）` }
  line.settleQty = roundSettleQty(total)
  line.settleUniformValue = undefined
  line.settlePieceValues = undefined
  return { ok: true, settleQty: line.settleQty }
}

export function calcInboundLineTotalPrice(line = {}) {
  if (hasSettleUnit(line)) materializeSettleQty(line)
  const qty = hasSettleUnit(line)
    ? resolvePricingQty(line)
    : Number(getStockUnitQtyValue(line)) || 0
  const price = Number(line.unitPrice) || 0
  return roundMoney(qty * price)
}

export function enrichInboundLinePricing(line = {}) {
  return { totalPrice: calcInboundLineTotalPrice(line) }
}

export function syncInboundLineTotalFromUnit(line) {
  line.totalPrice = calcInboundLineTotalPrice(line)
}

export function syncInboundLineUnitFromTotal(line) {
  const qty = Number(getStockUnitQtyValue(line)) || 0
  if (qty <= 0) return
  line.unitPrice = roundMoney((Number(line.totalPrice) || 0) / qty)
}

export function getTotalStockQty(itemCode) {
  if (!itemCode) return 0
  void stockState.records
  const total = stockState.records
    .filter((r) => r.itemCode === itemCode)
    .reduce((sum, r) => sum + (Number(r.qty) || 0), 0)
  if (total > 0) return roundQty(total)
  return roundQty(demoStockQty(10, String(itemCode).length))
}

export function getWarehouseStockQty(warehouse, itemCode) {
  if (!warehouse || !itemCode) return 0
  void stockState.records
  const qty = getStockQty(warehouse, itemCode)
  if (qty > 0) return roundQty(qty)
  return roundQty(demoStockQty(5, String(itemCode).length))
}

export function enrichInboundLineStock(line = {}) {
  const itemCode = line.itemCode || ''
  const warehouse = line.warehouse || ''
  return {
    stockQty: getTotalStockQty(itemCode),
    warehouseStockQty: getWarehouseStockQty(warehouse, itemCode),
  }
}

export function enrichInboundLine(line = {}) {
  const next = { ...line }
  applyDualUnitFieldsToInboundLine(next)
  return {
    ...next,
    ...enrichInboundLineStock(next),
    ...enrichInboundLinePricing(next),
  }
}

export function buildInboundLineFromPickerItem(item, defaultWarehouse = '') {
  const line = createInboundLine({
    itemId: item.itemId,
    itemCode: item.code,
    itemName: item.name,
    itemType: item.itemType,
    specAttr: item.productAttribute || item.materialType || '',
    specModel: item.specModel || '',
    material: item.material || '',
    drawingNo: item.drawingNo || '',
    unit: item.inventoryUnit || '件',
    unitPrice: item.unitPrice ?? null,
    qty: 1,
    warehouse: defaultWarehouse || '',
    isSpuLine: item.isSpuLine === true,
    spuId: item.spuId || '',
    spuName: item.spuName || '',
    productId: item.productId || item.itemId || '',
    variantValues: item.variantValues ? { ...item.variantValues } : {},
    variantSummary: item.variantSummary || '',
  })
  return enrichInboundLine(line)
}

export function buildInboundLinesFromBom(
  pickerRow,
  inboundQty = 1,
  defaultWarehouse = '',
  includeTopItem = false,
) {
  const storeType = pickerRow.itemType === '产品' ? 'product' : 'material'
  const bom = getOwnActiveBomForItem(storeType, pickerRow.itemId)
  if (!bom?.lineItems?.length) return []

  const qty = Number(inboundQty) || 1
  const map = new Map()

  const pushLine = (partial, lineQty) => {
    const code = partial.itemCode
    if (!code) return
    const lineQtyVal = roundQty(lineQty)
    if (map.has(code)) {
      const hit = map.get(code)
      hit.qty = roundQty(hit.qty + lineQtyVal)
      Object.assign(hit, enrichInboundLinePricing(hit))
      return
    }
    const line = enrichInboundLine(
      createInboundLine({
        ...partial,
        qty: lineQtyVal || 1,
        sourceDocNo: partial.sourceDocNo || bom.bomNo || bom.bomName || '',
      }),
    )
    map.set(code, line)
  }

  if (includeTopItem) {
    pushLine(
      buildInboundLineFromPickerItem(
        {
          itemId: pickerRow.itemId,
          itemType: pickerRow.itemType,
          code: pickerRow.code,
          name: pickerRow.name,
          specModel: pickerRow.specModel,
          material: pickerRow.material,
          drawingNo: pickerRow.drawingNo,
          inventoryUnit: pickerRow.inventoryUnit || '件',
          unitPrice: pickerRow.unitPrice,
        },
        defaultWarehouse,
      ),
      qty,
    )
  }

  bom.lineItems.forEach((line, index) => {
    const code = line.materialCode || line.itemCode || ''
    pushLine(
      createInboundLine({
        itemCode: code,
        itemName: line.itemName || line.materialName || '',
        itemType: line.itemType || '物料',
        specModel: line.specModel || '',
        specAttr: line.specAttr || '',
        material: line.material || '',
        drawingNo: line.drawingNo || '',
        unit: line.unit || '件',
        unitPrice: line.unitPrice ?? null,
        warehouse: defaultWarehouse || '',
      }),
      (Number(line.unitQty) || 0) * qty || demoStockQty(1, index),
    )
  })

  return [...map.values()]
}

export function mergeInboundLines(existing = [], incoming = []) {
  const result = existing.map((l) => ({ ...l }))
  incoming.forEach((line) => {
    const code = line.itemCode
    if (!code) {
      result.push(enrichInboundLine({ ...line }))
      return
    }
    const hit = result.find((l) => l.itemCode === code)
    if (hit) {
      hit.qty = roundQty((Number(hit.qty) || 0) + (Number(line.qty) || 0))
      if (!hit.sourceDocNo && line.sourceDocNo) hit.sourceDocNo = line.sourceDocNo
      Object.assign(hit, enrichInboundLinePricing(hit))
      return
    }
    result.push(enrichInboundLine({ ...line }))
  })
  return result
}

export function createBlankInboundLine(defaultWarehouse = '') {
  return enrichInboundLine(
    createInboundLine({
      itemCode: '',
      itemName: '',
      qty: 1,
      warehouse: defaultWarehouse || '',
    }),
  )
}

export function applyPickerItemToInboundLine(line, item, defaultWarehouse = '') {
  const normalized = {
    itemId: item.itemId ?? item.id,
    itemType: item.itemType,
    code: item.code,
    name: item.name,
    specModel: item.specModel,
    material: item.material,
    drawingNo: item.drawingNo,
    inventoryUnit: item.inventoryUnit,
    unitPrice: item.unitPrice,
    productAttribute: item.productAttribute || item.materialType,
    materialType: item.materialType,
    isSpuLine: item.isSpuLine === true,
    spuId: item.spuId || '',
    spuName: item.spuName || '',
    productId: item.productId || '',
    variantValues: item.variantValues ? { ...item.variantValues } : {},
    variantSummary: item.variantSummary || '',
  }
  const fresh = buildInboundLineFromPickerItem(normalized, line.warehouse || defaultWarehouse || '')
  return enrichInboundLine({
    ...line,
    itemId: fresh.itemId,
    itemCode: fresh.itemCode,
    itemName: fresh.itemName,
    itemType: fresh.itemType,
    specAttr: fresh.specAttr,
    specModel: fresh.specModel,
    material: fresh.material,
    drawingNo: fresh.drawingNo,
    unit: fresh.unit,
    unitPrice: fresh.unitPrice ?? line.unitPrice,
    stockQty: fresh.stockQty,
    warehouseStockQty: fresh.warehouseStockQty,
    isSpuLine: fresh.isSpuLine,
    spuId: fresh.spuId,
    spuName: fresh.spuName,
    productId: fresh.productId,
    variantValues: fresh.variantValues ? { ...fresh.variantValues } : {},
    variantSummary: fresh.variantSummary || '',
    totalPrice: calcInboundLineTotalPrice({
      ...line,
      unitPrice: fresh.unitPrice ?? line.unitPrice,
    }),
  })
}

export function cloneInboundLine(line) {
  return enrichInboundLine(
    createInboundLine({
      ...line,
      id: undefined,
    }),
  )
}
