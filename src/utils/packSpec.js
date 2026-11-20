/** 产品自有包装规格：1 个包装单位 = N 个库存单位。散装不设固定含量。 */

export function createEmptyPackSpec(partial = {}) {
  return {
    id: partial.id || `pack-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name || '',
    packUnit: partial.packUnit || '',
    qty: partial.qty == null || partial.qty === '' ? null : Number(partial.qty),
    isBulk: Boolean(partial.isBulk),
    isDefault: Boolean(partial.isDefault),
    enabled: partial.enabled !== false,
    salesPrice: priceOrNull(partial.salesPrice),
    purchasePrice: priceOrNull(partial.purchasePrice),
    remark: partial.remark || '',
  }
}

function priceOrNull(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** 不含税单价，按库存单位。 */
export function formatPackPrice(value, inventoryUnit) {
  const n = priceOrNull(value)
  if (n == null) return '—'
  const unit = String(inventoryUnit || '').trim()
  return unit ? `${n.toFixed(2)} 元/${unit}` : n.toFixed(2)
}

export function formatPackSpecText(row, inventoryUnit) {
  if (!row) return '—'
  if (row.isBulk) return '散装，不设固定含量'
  const qty = Number(row.qty)
  const unit = String(row.packUnit || '').trim()
  const base = String(inventoryUnit || '').trim() || '库存单位'
  if (unit && Number.isFinite(qty) && qty > 0) return `1 ${unit} = ${qty} ${base}`
  return '—'
}

function parseLegacyPackSpec(text, inventoryUnit) {
  const raw = String(text || '').trim()
  if (!raw) return null
  if (raw === '散装') {
    return createEmptyPackSpec({ name: '散装', isBulk: true, isDefault: true })
  }
  const matched = raw.match(/^(\d+(?:\.\d+)?)(kg|g|吨|L|升|mL)\/(.+)$/)
  if (matched && (matched[2] === 'kg' || matched[2] === inventoryUnit)) {
    return createEmptyPackSpec({
      name: raw,
      packUnit: matched[3],
      qty: Number(matched[1]),
      isDefault: true,
    })
  }
  return createEmptyPackSpec({ name: raw, packUnit: '', qty: null, isDefault: true })
}

export function normalizePackSpecs(list, legacyPackSpec, inventoryUnit) {
  const source = Array.isArray(list) && list.length ? list : []
  const rows = source.length
    ? source.map((row) => createEmptyPackSpec(row))
    : [parseLegacyPackSpec(legacyPackSpec, inventoryUnit)].filter(Boolean)
  const enabled = rows.filter((row) => row.enabled !== false)
  if (enabled.length && !enabled.some((row) => row.isDefault)) {
    const first = rows.find((row) => row.enabled !== false)
    if (first) first.isDefault = true
  }
  return rows
}

export function listEnabledPackSpecs(master) {
  if (!master) return []
  return normalizePackSpecs(master.packSpecs, master.packSpec, master.inventoryUnit).filter(
    (row) => row.enabled !== false,
  )
}

export function defaultPackSpec(master) {
  const rows = listEnabledPackSpecs(master)
  return rows.find((row) => row.isDefault) || rows[0] || null
}

/** 下拉和明细展示：名称 + 换算。散装不写含量。 */
export function packSpecOptionLabel(row, inventoryUnit) {
  if (!row) return ''
  const name = String(row.name || '').trim() || '包装规格'
  if (row.isBulk) return `${name}（散装）`
  const text = formatPackSpecText(row, inventoryUnit)
  return text && text !== '—' ? `${name}（${text}）` : name
}

export function validatePackSpecs(list) {
  const rows = Array.isArray(list) ? list : []
  const names = new Set()
  let defaultCount = 0
  for (const row of rows) {
    const name = String(row.name || '').trim()
    if (!name) return { ok: false, message: '请填写包装规格名称' }
    if (names.has(name)) return { ok: false, message: `包装规格「${name}」重复` }
    names.add(name)
    if (!row.isBulk) {
      if (!String(row.packUnit || '').trim()) {
        return { ok: false, message: `请填写「${name}」的包装单位` }
      }
      const qty = Number(row.qty)
      if (!Number.isFinite(qty) || qty <= 0) {
        return { ok: false, message: `「${name}」的每件含量须大于 0` }
      }
    }
    if (priceOrNull(row.salesPrice) != null && Number(row.salesPrice) < 0) {
      return { ok: false, message: `「${name}」的销售单价不能小于 0` }
    }
    if (priceOrNull(row.purchasePrice) != null && Number(row.purchasePrice) < 0) {
      return { ok: false, message: `「${name}」的采购单价不能小于 0` }
    }
    if (row.enabled !== false && row.isDefault) defaultCount += 1
  }
  if (defaultCount > 1) return { ok: false, message: '只能有一条默认包装规格' }
  return { ok: true }
}
