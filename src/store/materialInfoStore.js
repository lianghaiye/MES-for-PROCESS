import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { migrateMaterialList } from '@/utils/masterDataMigrate'
import {
  generateSharedItemId,
  syncAfterMaterialSave,
  removeLinkedProduct,
} from '@/utils/productMaterialSync'
import { PROCESS_MATERIALS } from '@/mock/processMasterSeed'
import { dropLegacyPumpMasters } from '@/utils/legacyPumpMaster'
import { persistJson } from '@/utils/safeStorage'

const STORAGE_KEY = 'i_doms_material_info'
/** v28：锂盐副产品/回收料角色口径（洗渣水、母液等） */
const DATA_VERSION = 31
let codeSeq = 100048

function cloneProcessMaterials() {
  return PROCESS_MATERIALS.map((row) => ({ ...row }))
}

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
      if (Array.isArray(parsed.materials)) {
        const force = parsed.version !== DATA_VERSION
        if (force) return cloneProcessMaterials()
        return dropLegacyPumpMasters(
          mergeMasterRows(migrateMaterialList(parsed.materials), PROCESS_MATERIALS, false),
        )
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  persistJson(STORAGE_KEY, {
    version: DATA_VERSION,
    materials: materialInfoState.materials,
  })
}

export const materialInfoState = reactive({
  materials: loadFromStorage() || cloneProcessMaterials(),
})

watch(
  () => materialInfoState.materials,
  () => persist(),
  { deep: true },
)

export function generateMaterialCode() {
  codeSeq += 1
  return `01004${String(codeSeq).slice(-4)}`
}

export function addMaterial(record) {
  const id = record.id || (record.isProductMaterial ? generateSharedItemId() : `mat-${Date.now()}`)
  const row = {
    ...record,
    id,
    createdAt: dayjs().format('YYYY-MM-DD'),
  }
  materialInfoState.materials.unshift(row)
  syncAfterMaterialSave(row, { isEdit: false })
  return row
}

export function updateMaterial(id, patch) {
  const idx = materialInfoState.materials.findIndex((m) => m.id === id)
  if (idx === -1) return null
  const prev = materialInfoState.materials[idx]
  const wasLinked = Boolean(prev.isProductMaterial)
  Object.assign(materialInfoState.materials[idx], patch)
  const row = materialInfoState.materials[idx]
  syncAfterMaterialSave(row, {
    isEdit: true,
    previousId: wasLinked && !row.isProductMaterial ? id : undefined,
  })
  return row
}

export function deleteMaterial(id) {
  const idx = materialInfoState.materials.findIndex((m) => m.id === id)
  if (idx === -1) return false
  const row = materialInfoState.materials[idx]
  materialInfoState.materials.splice(idx, 1)
  if (row.isProductMaterial) removeLinkedProduct(id)
  return true
}

export function cloneMaterial(id) {
  const source = materialInfoState.materials.find((m) => m.id === id)
  if (!source) return null
  const cloned = JSON.parse(JSON.stringify(source))
  cloned.id = `mat-${Date.now()}`
  cloned.code = generateMaterialCode()
  cloned.name = `${source.name}-克隆`
  cloned.isProductMaterial = false
  materialInfoState.materials.unshift(cloned)
  return cloned
}
