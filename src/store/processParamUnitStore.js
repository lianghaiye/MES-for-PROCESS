import { reactive, watch } from 'vue'

const STORAGE_KEY = 'i-doms-process-param-unit-v1'

export const PARAM_UNIT_STATUS = {
  ENABLED: '启用',
  DISABLED: '停用',
}

export const PARAM_UNIT_CATEGORIES = [
  '温度',
  '时间',
  '转速',
  '压力',
  '流量',
  '酸碱',
  '电气',
  '其他',
]

const SEED = [
  { code: 'PPU001', name: '℃', category: '温度', remark: '反应温度、保温温度', sort: 10 },
  { code: 'PPU002', name: 'min', category: '时间', remark: '保温、搅拌时长', sort: 20 },
  { code: 'PPU003', name: 'h', category: '时间', remark: '长周期', sort: 30 },
  { code: 'PPU004', name: 's', category: '时间', remark: '短时计时', sort: 40 },
  { code: 'PPU005', name: 'rpm', category: '转速', remark: '搅拌转速', sort: 50 },
  { code: 'PPU006', name: 'pH', category: '酸碱', remark: '酸碱度', sort: 60 },
  { code: 'PPU007', name: 'MPa', category: '压力', remark: '釜压、管压', sort: 70 },
  { code: 'PPU008', name: 'kPa', category: '压力', remark: '低压', sort: 80 },
  { code: 'PPU009', name: '%', category: '其他', remark: '开度等无量纲比例', sort: 90 },
  { code: 'PPU010', name: 'm³/h', category: '流量', remark: '体积流量', sort: 100 },
  { code: 'PPU011', name: 'L/min', category: '流量', remark: '小流量', sort: 110 },
  { code: 'PPU012', name: 'A', category: '电气', remark: '电流', sort: 120 },
  { code: 'PPU013', name: 'Hz', category: '电气', remark: '变频器频率', sort: 130 },
]

function seedRows() {
  return SEED.map((row) => ({
    ...row,
    id: row.code,
    status: PARAM_UNIT_STATUS.ENABLED,
  }))
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedRows()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return seedRows()
    return parsed
  } catch {
    return seedRows()
  }
}

export const processParamUnitState = reactive({
  units: load(),
})

watch(
  () => processParamUnitState.units,
  () => localStorage.setItem(STORAGE_KEY, JSON.stringify(processParamUnitState.units)),
  { deep: true },
)

export function listProcessParamUnits() {
  return [...processParamUnitState.units].sort(
    (a, b) => (a.sort || 0) - (b.sort || 0) || String(a.code).localeCompare(String(b.code)),
  )
}

export function getEnabledProcessParamUnitOptions() {
  return listProcessParamUnits()
    .filter((row) => row.status === PARAM_UNIT_STATUS.ENABLED)
    .map((row) => ({ label: row.name, value: row.name, category: row.category }))
}

function nextCode() {
  const nums = processParamUnitState.units.map((row) => {
    const matched = String(row.code || '').match(/(\d+)$/)
    return matched ? Number(matched[1]) : 0
  })
  const next = Math.max(0, ...nums) + 1
  return `PPU${String(next).padStart(3, '0')}`
}

export function saveProcessParamUnit(payload, id) {
  const name = String(payload.name || '').trim()
  const category = String(payload.category || '').trim()
  if (!name) return { ok: false, message: '请填写单位符号' }
  if (!PARAM_UNIT_CATEGORIES.includes(category)) return { ok: false, message: '请选择类别' }
  const duplicated = processParamUnitState.units.find((row) => row.id !== id && row.name === name)
  if (duplicated) return { ok: false, message: `单位「${name}」已存在` }
  if (!id) {
    const row = {
      id: `ppu-${Date.now()}`,
      code: nextCode(),
      name,
      category,
      remark: String(payload.remark || '').trim(),
      status: PARAM_UNIT_STATUS.ENABLED,
      sort: (processParamUnitState.units.length + 1) * 10,
    }
    processParamUnitState.units.push(row)
    return { ok: true, row }
  }
  const current = processParamUnitState.units.find((row) => row.id === id)
  if (!current) return { ok: false, message: '单位不存在' }
  current.name = name
  current.category = category
  current.remark = String(payload.remark || '').trim()
  return { ok: true, row: current }
}

export function setProcessParamUnitStatus(id, status) {
  const current = processParamUnitState.units.find((row) => row.id === id)
  if (!current) return { ok: false, message: '单位不存在' }
  current.status = status
  return { ok: true }
}

export function deleteProcessParamUnit(id) {
  const index = processParamUnitState.units.findIndex((row) => row.id === id)
  if (index < 0) return { ok: false, message: '单位不存在' }
  processParamUnitState.units.splice(index, 1)
  return { ok: true }
}
