/**
 * 主数据两套单价的口径和取价顺序。
 *
 * 口径：
 * - 销售页标准单价、包装规格上的销售单价、包装规格上的采购单价：元/库存单位
 * - 采购页供应商单价、采购单价：元/采购单位。采购单用这个数乘采购数量
 *
 * 采购：
 * 1. 行上指定了包装规格，且该规格有采购单价，并能折成采购单位
 * 2. 采购页中与当前供应商匹配的不含税单价
 * 3. 采购页的采购单价
 *
 * 销售：
 * 1. 行上指定了包装规格，且该规格有销售单价
 * 2. 销售页标准单价
 *
 * 未指定包装规格时，不拿默认包装规格的价格。
 */

import { hydratePurchaseSuppliers } from '@/utils/purchaseSuppliers'
import {
  resolveInventoryUnit,
  resolvePurchaseConvertRate,
  resolvePurchaseUnit,
} from '@/utils/purchaseUomConvert'

function positive(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function findPackSpec(master, packSpecId) {
  const id = String(packSpecId || '').trim()
  if (!id || !master) return null
  const rows = Array.isArray(master.packSpecs) ? master.packSpecs : []
  return rows.find((row) => row.id === id && row.enabled !== false) || null
}

function roundPrice(value) {
  return Math.round(Number(value) * 10000) / 10000
}

/** 包装规格采购单价（元/库存单位）折成元/采购单位。单位相同或没有换算率时无法折算则返回 null。 */
function packPurchasePriceInPurchaseUnit(master, pack) {
  const price = positive(pack?.purchasePrice)
  if (price == null) return null
  const purchaseUnit = resolvePurchaseUnit(master || {})
  const inventoryUnit = resolveInventoryUnit(master || {})
  if (!purchaseUnit || purchaseUnit === inventoryUnit) return price
  const rate = resolvePurchaseConvertRate(master || {})
  if (!(rate > 0)) return null
  return roundPrice(price * rate)
}

function supplierPrice(master, supplierName) {
  const rows = hydratePurchaseSuppliers(master || {})
  const name = String(supplierName || '').trim()
  const matched = name
    ? rows.find(
        (row) =>
          String(row.supplierName || '').trim() === name && positive(row.unitPriceExTax) != null,
      )
    : null
  if (matched) return positive(matched.unitPriceExTax)
  if (!name) {
    const any = rows.find((row) => positive(row.unitPriceExTax) != null)
    if (any) return positive(any.unitPriceExTax)
  }
  return null
}

export function resolvePurchaseListPrice(master, { supplierName, packSpecId } = {}) {
  const pack = findPackSpec(master, packSpecId)
  const fromPack = packPurchasePriceInPurchaseUnit(master, pack)
  if (fromPack != null) {
    return { price: fromPack, source: 'pack', priceUnit: 'purchase' }
  }
  const fromSupplier = supplierPrice(master, supplierName)
  if (fromSupplier != null) {
    return { price: fromSupplier, source: 'supplier', priceUnit: 'purchase' }
  }
  const fromPage = positive(master?.purchaseUnitPrice)
  if (fromPage != null) {
    return { price: fromPage, source: 'purchase', priceUnit: 'purchase' }
  }
  return { price: 0, source: 'none', priceUnit: 'purchase' }
}

export function resolveSalesListPrice(master, { packSpecId } = {}) {
  const pack = findPackSpec(master, packSpecId)
  const fromPack = positive(pack?.salesPrice)
  if (fromPack != null) {
    return { price: fromPack, source: 'pack', priceUnit: 'inventory' }
  }
  const fromPage = positive(master?.unitPrice)
  if (fromPage != null) {
    return { price: fromPage, source: 'standard', priceUnit: 'inventory' }
  }
  return { price: 0, source: 'none', priceUnit: 'inventory' }
}
