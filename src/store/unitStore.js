import { reactive, watch } from 'vue'
import dayjs from 'dayjs'

const STORAGE_KEY = 'i_doms_measure_units'
const SEED_VERSION_KEY = 'i_doms_measure_units_seed_v'
/** v4：包装单位增加吨桶、吨袋 */
const CURRENT_SEED_VERSION = '4'

/** 适用类型 */
export const UNIT_SCOPE = {
  INVENTORY: 'inventory',
  PURCHASE: 'purchase',
}

export const UNIT_SCOPE_OPTIONS = [
  { label: '库存单位', value: UNIT_SCOPE.INVENTORY },
  { label: '采购单位', value: UNIT_SCOPE.PURCHASE },
]

export const UNIT_STATUS = {
  ENABLED: '启用',
  DISABLED: '停用',
}

/** 取舍规则 */
export const UNIT_ROUNDING = {
  HALF_UP: 'round',
  CEIL: 'ceil',
  FLOOR: 'floor',
}

export const UNIT_ROUNDING_OPTIONS = [
  { label: '四舍五入', value: UNIT_ROUNDING.HALF_UP },
  { label: '向上保留', value: UNIT_ROUNDING.CEIL },
  { label: '向下保留', value: UNIT_ROUNDING.FLOOR },
]

export const UNIT_ROUNDING_LABEL = {
  [UNIT_ROUNDING.HALF_UP]: '四舍五入',
  [UNIT_ROUNDING.CEIL]: '向上保留',
  [UNIT_ROUNDING.FLOOR]: '向下保留',
}

const DECIMAL_UNIT_NAMES = new Set([
  'kg',
  'g',
  'mg',
  't',
  '吨',
  'm',
  '米',
  'cm',
  'mm',
  '㎡',
  'm²',
  'm³',
  '立方米',
  'L',
  'l',
  '升',
  'ml',
  'mL',
  '毫升',
])

function defaultPrecisionForName(name) {
  return DECIMAL_UNIT_NAMES.has(String(name || '').trim()) ? 2 : 0
}

function defaultRoundingForName(name) {
  // 称重/长度类默认向上保留，计数类默认四舍五入（对齐常见现场口径）
  return DECIMAL_UNIT_NAMES.has(String(name || '').trim())
    ? UNIT_ROUNDING.CEIL
    : UNIT_ROUNDING.HALF_UP
}

function seedUnits() {
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const both = ['inventory', 'purchase']
  // 排序即使用频率：质量、体积在前，包装在后
  const rows = [
    {
      code: 'UNIT005',
      name: 'kg',
      scopes: both,
      sort: 10,
      precision: 2,
      remark: '配方、库存、投料的主单位',
    },
    {
      code: 'UNIT013',
      name: '升',
      scopes: both,
      sort: 20,
      precision: 2,
      remark: '液体体积。与公斤换算取物料密度',
    },
    {
      code: 'UNIT014',
      name: '吨',
      scopes: both,
      sort: 30,
      precision: 3,
      remark: '大宗原料。1 吨 = 1000 kg',
    },
    { code: 'UNIT015', name: 'g', scopes: both, sort: 40, precision: 2, remark: '小料、助剂' },
    {
      code: 'UNIT016',
      name: 'mL',
      scopes: both,
      sort: 50,
      precision: 2,
      remark: '微量液体。1000 mL = 1 升',
    },
    {
      code: 'UNIT017',
      name: 'm³',
      scopes: both,
      sort: 60,
      precision: 3,
      remark: '储罐与大宗液体。1 m³ = 1000 升',
    },
    {
      code: 'UNIT018',
      name: '桶',
      scopes: both,
      sort: 70,
      precision: 0,
      remark: '包装单位，换算率写在具体物料上',
    },
    { code: 'UNIT019', name: '袋', scopes: both, sort: 80, precision: 0, remark: '粉体包装' },
    { code: 'UNIT020', name: '瓶', scopes: both, sort: 90, precision: 0, remark: '小包装液体' },
    { code: 'UNIT021', name: '罐', scopes: both, sort: 100, precision: 0, remark: '成品罐装' },
    {
      code: 'UNIT023',
      name: '吨桶',
      scopes: both,
      sort: 105,
      precision: 0,
      remark: '大宗液体包装',
    },
    { code: 'UNIT024', name: '吨袋', scopes: both, sort: 108, precision: 0, remark: '粉体吨包装' },
    { code: 'UNIT002', name: '件', scopes: both, sort: 110, precision: 0, remark: '成件出货' },
    { code: 'UNIT022', name: 'mg', scopes: both, sort: 120, precision: 2, remark: '微量固体' },
  ]
  return rows.map((r, i) =>
    normalizeUnit({
      id: `unit-${i + 1}`,
      code: r.code,
      name: r.name,
      scopes: [...r.scopes],
      status: UNIT_STATUS.ENABLED,
      precision: r.precision,
      roundingRule: defaultRoundingForName(r.name),
      remark: r.remark,
      sort: r.sort,
      creator: 'admin',
      createdAt: now,
      updatedAt: now,
    }),
  )
}

function loadFromStorage() {
  try {
    if (localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION) return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.units) && parsed.units.length) {
        return parsed.units.map(normalizeUnit)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function normalizeRoundingRule(value, unitName) {
  const v = String(value || '').trim()
  if (v === UNIT_ROUNDING.HALF_UP || v === '四舍五入') return UNIT_ROUNDING.HALF_UP
  if (v === UNIT_ROUNDING.CEIL || v === '向上保留' || v === '向上取整') return UNIT_ROUNDING.CEIL
  if (v === UNIT_ROUNDING.FLOOR || v === '向下保留' || v === '向下取整') return UNIT_ROUNDING.FLOOR
  return defaultRoundingForName(unitName)
}

function normalizePrecision(value, unitName) {
  if (value === '' || value == null) return defaultPrecisionForName(unitName)
  const n = Number(value)
  if (!Number.isFinite(n)) return defaultPrecisionForName(unitName)
  return Math.min(6, Math.max(0, Math.round(n)))
}

function normalizeUnit(row) {
  const scopes = Array.isArray(row.scopes)
    ? row.scopes.filter((s) => s === UNIT_SCOPE.INVENTORY || s === UNIT_SCOPE.PURCHASE)
    : []
  // 兼容旧字段
  if (!scopes.length) {
    if (row.forInventory !== false) scopes.push(UNIT_SCOPE.INVENTORY)
    if (row.forPurchase) scopes.push(UNIT_SCOPE.PURCHASE)
    if (!scopes.length) scopes.push(UNIT_SCOPE.INVENTORY)
  }
  const name = String(row.name || '').trim()
  return {
    id: row.id,
    code: String(row.code || '').trim(),
    name,
    scopes: [...new Set(scopes)],
    status: row.status === UNIT_STATUS.DISABLED ? UNIT_STATUS.DISABLED : UNIT_STATUS.ENABLED,
    precision: normalizePrecision(row.precision, name),
    roundingRule: normalizeRoundingRule(row.roundingRule, name),
    remark: row.remark || '',
    sort: Number.isFinite(Number(row.sort)) ? Number(row.sort) : 0,
    creator: row.creator || 'admin',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    lastModifier: row.lastModifier || '',
  }
}

export function formatUnitRoundingRule(rule) {
  return UNIT_ROUNDING_LABEL[rule] || UNIT_ROUNDING_LABEL[UNIT_ROUNDING.HALF_UP]
}

/** 按单位精度与取舍规则格式化数量（业务侧可选调用） */
export function roundQtyByUnit(qty, unitOrName) {
  const n = Number(qty)
  if (!Number.isFinite(n)) return 0
  const name = typeof unitOrName === 'string' ? unitOrName : unitOrName?.name
  const unit =
    (typeof unitOrName === 'object' && unitOrName) ||
    unitState.units.find((u) => u.name === name) ||
    null
  const precision = unit ? Number(unit.precision) : defaultPrecisionForName(name)
  const rule = unit ? unit.roundingRule : defaultRoundingForName(name)
  const factor = 10 ** Math.min(6, Math.max(0, precision || 0))
  if (rule === UNIT_ROUNDING.CEIL) return Math.ceil(n * factor - 1e-12) / factor
  if (rule === UNIT_ROUNDING.FLOOR) return Math.floor(n * factor + 1e-12) / factor
  return Math.round(n * factor) / factor
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ units: unitState.units }))
  localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

export const unitState = reactive({
  units: loadFromStorage() || seedUnits(),
})

watch(
  () => unitState.units,
  () => persist(),
  { deep: true },
)

function sortedUnits(list) {
  return [...list].sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.code.localeCompare(b.code))
}

export function getUnitById(id) {
  return unitState.units.find((u) => u.id === id) || null
}

export function formatUnitScopes(scopes = []) {
  const labels = []
  if (scopes.includes(UNIT_SCOPE.INVENTORY)) labels.push('库存单位')
  if (scopes.includes(UNIT_SCOPE.PURCHASE)) labels.push('采购单位')
  return labels.join('、') || '—'
}

/** 库存单位下拉（启用） */
export function getInventoryUnitOptions() {
  void unitState.units
  return sortedUnits(unitState.units)
    .filter((u) => u.status === UNIT_STATUS.ENABLED && u.scopes.includes(UNIT_SCOPE.INVENTORY))
    .map((u) => ({ label: u.name, value: u.name, code: u.code }))
}

/** 采购单位下拉（启用） */
export function getPurchaseUnitOptions() {
  void unitState.units
  return sortedUnits(unitState.units)
    .filter((u) => u.status === UNIT_STATUS.ENABLED && u.scopes.includes(UNIT_SCOPE.PURCHASE))
    .map((u) => ({ label: u.name, value: u.name, code: u.code }))
}

/** 全部启用单位（BOM/工单等通用计量） */
export function getAllEnabledUnitOptions() {
  void unitState.units
  return sortedUnits(unitState.units)
    .filter((u) => u.status === UNIT_STATUS.ENABLED)
    .map((u) => ({ label: u.name, value: u.name, code: u.code }))
}

/** 兼容旧 mock：返回名称数组 */
export function getInventoryUnitNames() {
  return getInventoryUnitOptions().map((o) => o.value)
}

export function getPurchaseUnitNames() {
  return getPurchaseUnitOptions().map((o) => o.value)
}

function nextUnitCode() {
  const nums = unitState.units
    .map((u) => {
      const m = String(u.code || '').match(/^UNIT(\d+)$/i)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const max = nums.length ? Math.max(...nums) : 0
  return `UNIT${String(max + 1).padStart(3, '0')}`
}

export function addUnit(payload, operator = 'admin') {
  const name = payload.name?.trim()
  const code = (payload.code?.trim() || nextUnitCode()).toUpperCase()
  const scopes = Array.isArray(payload.scopes) ? [...new Set(payload.scopes)] : []
  if (!name) return { ok: false, message: '请输入单位名称' }
  if (!scopes.length) return { ok: false, message: '请至少选择一种适用类型（库存/采购）' }
  if (unitState.units.some((u) => u.code === code)) {
    return { ok: false, message: '单位编码已存在' }
  }
  if (unitState.units.some((u) => u.name === name)) {
    return { ok: false, message: '单位名称已存在' }
  }
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const row = normalizeUnit({
    id: `unit-${Date.now()}`,
    code,
    name,
    scopes,
    status: payload.status || UNIT_STATUS.ENABLED,
    precision: payload.precision,
    roundingRule: payload.roundingRule,
    remark: payload.remark || '',
    sort: payload.sort ?? (unitState.units.length + 1) * 10,
    creator: operator,
    createdAt: now,
    updatedAt: now,
  })
  unitState.units.unshift(row)
  return { ok: true, data: row }
}

export function updateUnit(id, patch, operator = 'admin') {
  const idx = unitState.units.findIndex((u) => u.id === id)
  if (idx < 0) return { ok: false, message: '单位不存在' }
  const name = patch.name?.trim()
  const code = patch.code?.trim()?.toUpperCase()
  const scopes = Array.isArray(patch.scopes) ? [...new Set(patch.scopes)] : null
  if (name === '') return { ok: false, message: '请输入单位名称' }
  if (scopes && !scopes.length) return { ok: false, message: '请至少选择一种适用类型（库存/采购）' }
  if (code && unitState.units.some((u) => u.code === code && u.id !== id)) {
    return { ok: false, message: '单位编码已存在' }
  }
  if (name && unitState.units.some((u) => u.name === name && u.id !== id)) {
    return { ok: false, message: '单位名称已存在' }
  }
  const current = unitState.units[idx]
  Object.assign(
    current,
    normalizeUnit({
      ...current,
      ...patch,
      code: code || current.code,
      name: name || current.name,
      scopes: scopes || current.scopes,
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      lastModifier: operator,
    }),
  )
  return { ok: true, data: current }
}

export function deleteUnit(id) {
  const idx = unitState.units.findIndex((u) => u.id === id)
  if (idx < 0) return { ok: false, message: '单位不存在' }
  unitState.units.splice(idx, 1)
  return { ok: true }
}

export function setUnitStatus(id, status, operator = 'admin') {
  return updateUnit(id, { status }, operator)
}
