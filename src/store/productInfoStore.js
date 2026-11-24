import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { migrateProductList } from '@/utils/masterDataMigrate'
import { dropLegacyPumpMasters } from '@/utils/legacyPumpMaster'
import {
  generateSharedItemId,
  syncAfterProductSave,
  removeLinkedMaterial,
} from '@/utils/productMaterialSync'
import { applyLaborConfigSeed } from '@/mock/laborConfigSeed'
import { PROCESS_PRODUCTS } from '@/mock/processMasterSeed'
import { persistJson } from '@/utils/safeStorage'
import {
  PRODUCT_STATUS,
  isProductActive,
  isProductArchived,
  normalizeProductStatus,
} from '@/utils/productStatus'

const STORAGE_KEY = 'i_doms_product_info'
/** v21：锂盐产出角色口径（卤水副产、洗渣水/母液回收等） */
const DATA_VERSION = 21

export { PRODUCT_STATUS, isProductActive, isProductArchived, normalizeProductStatus }
let codeSeq = 20000

function mergeMasterRows(list, rows, overwrite) {
  const next = Array.isArray(list) ? [...list] : []
  rows.forEach((demo) => {
    const idx = next.findIndex((row) => row.id === demo.id || row.code === demo.code)
    if (idx === -1) next.unshift({ ...demo })
    else if (overwrite) next[idx] = { ...demo, id: demo.id }
  })
  return next
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.products)) {
        const force = parsed.version !== DATA_VERSION
        return mergeMasterRows(
          dropLegacyPumpMasters(
            applyLaborConfigSeed(migrateProductList(parsed.products), { force }),
          ),
          PROCESS_PRODUCTS,
          force,
        )
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  persistJson(STORAGE_KEY, { version: DATA_VERSION, products: productInfoState.products })
}

export const productInfoState = reactive({
  products: loadFromStorage() || dropLegacyPumpMasters(PROCESS_PRODUCTS.map((row) => ({ ...row }))),
})

watch(
  () => productInfoState.products,
  () => persist(),
  { deep: true },
)

export function generateProductCode() {
  codeSeq += 1
  return `CP${dayjs().format('YY')}${String(codeSeq).slice(-5)}`
}

export function addProduct(record) {
  const now = dayjs().format('YYYY-MM-DD')
  const id = record.id || (record.isProductMaterial ? generateSharedItemId() : `prod-${Date.now()}`)
  const row = {
    ...record,
    id,
    status: normalizeProductStatus(record.status),
    createdAt: now,
    updatedAt: now,
  }
  productInfoState.products.unshift(row)
  syncAfterProductSave(row, { isEdit: false })
  return row
}

/** 可选产品（选品弹窗等）：排除已归档 */
export function getSelectableProducts() {
  return productInfoState.products.filter((p) => isProductActive(p))
}

/**
 * 归档产品（状态变更）。
 * BOM 直接引用的联动处理由 UI（ProductArchiveReferenceModal）在调用前完成；
 * 不校验工单/订单引用，已有引用不受影响。
 */
export function archiveProduct(id) {
  return updateProduct(id, { status: PRODUCT_STATUS.ARCHIVED })
}

export function unarchiveProduct(id) {
  return updateProduct(id, { status: PRODUCT_STATUS.ACTIVE })
}

export function updateProduct(id, patch) {
  const idx = productInfoState.products.findIndex((p) => p.id === id)
  if (idx === -1) return null
  const prev = productInfoState.products[idx]
  const wasLinked = Boolean(prev.isProductMaterial)
  Object.assign(productInfoState.products[idx], patch, {
    updatedAt: dayjs().format('YYYY-MM-DD'),
  })
  const row = productInfoState.products[idx]
  syncAfterProductSave(row, {
    isEdit: true,
    previousId: wasLinked && !row.isProductMaterial ? id : undefined,
  })
  return row
}

export function deleteProduct(id) {
  const idx = productInfoState.products.findIndex((p) => p.id === id)
  if (idx === -1) return false
  const row = productInfoState.products[idx]
  productInfoState.products.splice(idx, 1)
  if (row.isProductMaterial) removeLinkedMaterial(id)
  return true
}

export function cloneProduct(id) {
  const source = productInfoState.products.find((p) => p.id === id)
  if (!source) return null
  const cloned = JSON.parse(JSON.stringify(source))
  cloned.id = `prod-${Date.now()}`
  cloned.code = generateProductCode()
  cloned.name = `${source.name}-克隆`
  cloned.isProductMaterial = false
  cloned.status = PRODUCT_STATUS.ACTIVE
  const now = dayjs().format('YYYY-MM-DD')
  cloned.createdAt = now
  cloned.updatedAt = now
  productInfoState.products.unshift(cloned)
  return cloned
}
