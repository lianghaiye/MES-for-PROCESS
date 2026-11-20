import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { createProcessRouteSeed } from '@/mock/processRouteSeed'
import { ensureSerialRouteDemo } from '@/mock/serialRouteDispatchDemoSeed'
import { ensureParallelRouteDemo } from '@/mock/parallelRouteDispatchDemoSeed'
import { processConfigState } from '@/store/processConfigStore'
import {
  createEmptyGrid,
  normalizeGrid,
  syncStepPolicies,
  unitsFromGrid,
  validateCellReturns,
  validateProcessRouteGrid,
} from '@/utils/processRouteGrid'
import { defaultQcConfigsFromOperations } from '@/utils/qcProcessConfig'
import { persistJson, safeSetItem } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'
import {
  ROUTE_MODE_EQUIPMENT,
  ROUTE_MODE_PROCESS,
  normalizeRouteMode,
} from '@/constants/processRouteMode'

/** 演示：保证「过滤」已配质检，路线侧可出现「本路线质检」覆盖项 */
function ensureFiltrationHasQc() {
  const proc = processConfigState.processes.find((p) => p.name === '过滤')
  if (!proc) return
  const hasQc =
    Boolean(proc.operations?.opQc) ||
    (Array.isArray(proc.qcConfigs) && proc.qcConfigs.some((c) => c?.enabled !== false))
  if (hasQc) return
  proc.operations = { ...(proc.operations || {}), opQc: true }
  proc.qcConfigs = defaultQcConfigsFromOperations(proc.operations)
}

function resolveOperatorName() {
  const user = getUser()
  return user?.name || user?.username || user?.realName || 'admin1'
}

/** 设备顺序：一台设备只保留第一次出现 */
export function normalizeRouteUnits(units) {
  const seen = new Set()
  const rows = []
  for (const item of units || []) {
    const equipmentId = String(item?.equipmentId || '').trim()
    if (!equipmentId || seen.has(equipmentId)) continue
    seen.add(equipmentId)
    rows.push({ equipmentId })
  }
  return rows
}

function normalizeRouteRow(row) {
  if (!row) return row
  if (!row.creator) row.creator = 'admin1'
  if (!row.updater) row.updater = row.creator || 'admin1'
  row.units = normalizeRouteUnits(row.units)
  if (Array.isArray(row.grid)) row.grid = normalizeGrid(row.grid)
  if (row.routeMode) row.routeMode = normalizeRouteMode(row.routeMode)
  else if (
    (row.units || []).length &&
    !(row.grid || []).some((step) => (step || []).some((c) => c?.processId))
  ) {
    row.routeMode = ROUTE_MODE_EQUIPMENT
  } else {
    row.routeMode = ROUTE_MODE_PROCESS
  }
  return row
}

const STORAGE_KEY = 'i_doms_process_routes'
const SEED_VERSION_KEY = 'i_doms_process_routes_seed_v'
const CURRENT_SEED_VERSION = '2'

function getProcessIdByName(name) {
  const proc = processConfigState.processes.find((p) => p.name === name)
  return proc?.id || `proc-unknown-${name}`
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.routes)) return parsed.routes
    }
  } catch {
    /* ignore */
  }
  return null
}

function shouldReseed() {
  return localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION
}

function persist() {
  persistJson(STORAGE_KEY, { routes: processRouteState.routes })
  safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

export function generateProcessRouteCode(existingCodes = []) {
  const max = existingCodes.reduce((m, code) => {
    const n = Number(String(code).replace(/\D/g, '').slice(-4)) || 0
    return Math.max(m, n)
  }, 0)
  return `GYLX${String(max + 1).padStart(4, '0')}`
}

export const ROUTE_STATUS = ['新建', '使用中', '已归档']
export const APPLY_SCOPES = ['全部产品', '单个物品', '物品类别']

function loadInitialRoutes() {
  const routes = shouldReseed()
    ? createProcessRouteSeed(getProcessIdByName)
    : loadFromStorage() || createProcessRouteSeed(getProcessIdByName)
  return (routes || []).map((r) => normalizeRouteRow({ ...r }))
}

export const processRouteState = reactive({
  routes: loadInitialRoutes(),
})

// 本地已有路线缓存时，仍补齐串行/并行演示路线
try {
  ensureFiltrationHasQc()
  ensureSerialRouteDemo()
  ensureParallelRouteDemo()
} catch (e) {
  console.warn('[processRouteStore] ensure route demos failed', e)
}
processRouteState.routes.forEach((r) => normalizeRouteRow(r))

watch(
  () => processRouteState.routes,
  () => persist(),
  { deep: true },
)

export function getProcessRouteById(id) {
  return processRouteState.routes.find((r) => r.id === id) || null
}

export function getProcessRouteByCode(code) {
  return processRouteState.routes.find((r) => r.code === code) || null
}

export function getProcessRouteByName(name) {
  return processRouteState.routes.find((r) => r.name === name) || null
}

/** 一条路线里出现多次仍算 1 */
export function countRoutesReferencingProcess(processId) {
  if (!processId) return 0
  return processRouteState.routes.filter((route) =>
    (route.grid || []).some((step) => (step || []).some((cell) => cell?.processId === processId)),
  ).length
}

export function resolveRouteProductDisplay(route) {
  if (!route) return ''
  if (route.applyScope === '全部产品') return ''
  return route.productDisplay || route.itemName || route.categoryName || ''
}

export function filterProcessRoutes(list, filters = {}) {
  return list.filter((r) => {
    if (filters.code && !r.code.includes(filters.code)) return false
    if (filters.name && !r.name.includes(filters.name)) return false
    if (filters.status && r.status !== filters.status) return false
    return true
  })
}

function validateRouteForm(payload) {
  if (!payload.name?.trim()) return { ok: false, message: '请输入工艺路线名称' }
  if (!payload.applyScope) return { ok: false, message: '请选择适用范围' }
  if (payload.applyScope === '单个物品') {
    if (!payload.itemId) return { ok: false, message: '请选择适用对象' }
  }
  if (payload.applyScope === '物品类别') {
    if (!payload.categoryKey) return { ok: false, message: '请选择适用对象' }
  }
  const routeMode = normalizeRouteMode(payload.routeMode)
  if (routeMode === ROUTE_MODE_EQUIPMENT) {
    const units = normalizeRouteUnits(payload.units)
    if (!units.length) return { ok: false, message: '请至少添加一台设备' }
    return { ok: true, routeMode, units }
  }
  const gridCheck = validateProcessRouteGrid(payload.grid)
  if (!gridCheck.ok) return gridCheck
  const returnCheck = validateCellReturns(payload.grid)
  if (!returnCheck.ok) return returnCheck
  return {
    ok: true,
    routeMode: ROUTE_MODE_PROCESS,
    units: normalizeRouteUnits(unitsFromGrid(payload.grid)),
  }
}

export function addProcessRoute(payload) {
  const check = validateRouteForm(payload)
  if (!check.ok) return check

  const codes = processRouteState.routes.map((r) => r.code)
  const operator = resolveOperatorName()
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const row = {
    id: `route-${Date.now()}`,
    code: payload.code || generateProcessRouteCode(codes),
    name: payload.name.trim(),
    status: payload.status || '使用中',
    applyScope: payload.applyScope,
    itemType: payload.itemType || '',
    itemId: payload.itemId || '',
    itemName: payload.itemName || '',
    itemCode: payload.itemCode || '',
    categoryType: payload.categoryType || '',
    categoryKey: payload.categoryKey || '',
    categoryName: payload.categoryName || '',
    productDisplay: payload.productDisplay || '',
    remark: payload.remark || '',
    routeMode: check.routeMode,
    units: check.units,
    grid:
      check.routeMode === ROUTE_MODE_PROCESS && payload.grid
        ? normalizeGrid(payload.grid)
        : createEmptyGrid(),
    stepPolicies:
      check.routeMode === ROUTE_MODE_PROCESS
        ? syncStepPolicies(payload.grid, payload.stepPolicies)
        : [],
    creator: operator,
    updater: operator,
    createdAt: now,
    updatedAt: now,
  }
  row.productDisplay = resolveRouteProductDisplay(row) || row.productDisplay
  processRouteState.routes.unshift(row)
  return { ok: true, route: row }
}

export function updateProcessRoute(id, payload) {
  const idx = processRouteState.routes.findIndex((r) => r.id === id)
  if (idx === -1) return { ok: false, message: '工艺路线不存在' }
  const check = validateRouteForm(payload)
  if (!check.ok) return check

  Object.assign(processRouteState.routes[idx], {
    name: payload.name.trim(),
    applyScope: payload.applyScope,
    itemType: payload.itemType || '',
    itemId: payload.itemId || '',
    itemName: payload.itemName || '',
    itemCode: payload.itemCode || '',
    categoryType: payload.categoryType || '',
    categoryKey: payload.categoryKey || '',
    categoryName: payload.categoryName || '',
    productDisplay: payload.productDisplay || '',
    remark: payload.remark || '',
    routeMode: check.routeMode,
    units: check.units,
    grid:
      check.routeMode === ROUTE_MODE_PROCESS && payload.grid
        ? normalizeGrid(payload.grid)
        : processRouteState.routes[idx].grid,
    stepPolicies:
      check.routeMode === ROUTE_MODE_PROCESS && payload.grid
        ? syncStepPolicies(payload.grid, payload.stepPolicies)
        : processRouteState.routes[idx].stepPolicies,
    updater: resolveOperatorName(),
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  })
  const row = processRouteState.routes[idx]
  row.productDisplay = resolveRouteProductDisplay(row) || row.productDisplay
  if (check.routeMode === ROUTE_MODE_EQUIPMENT) {
    row.units = check.units
  }
  return { ok: true, route: row }
}

/** 仅更新工艺路线网格结构（工单下发「保存并更新主数据」） */
export function updateProcessRouteStructure(id, { grid, stepPolicies } = {}) {
  const idx = processRouteState.routes.findIndex((r) => r.id === id)
  if (idx === -1) return { ok: false, message: '工艺路线不存在' }
  const gridCheck = validateProcessRouteGrid(grid)
  if (!gridCheck.ok) return gridCheck

  const row = processRouteState.routes[idx]
  row.grid = normalizeGrid(grid)
  row.stepPolicies = syncStepPolicies(grid, stepPolicies)
  row.updater = resolveOperatorName()
  row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return { ok: true, route: row }
}

/** 工艺路线不允许物理删除，请使用归档 */
export function deleteProcessRoute() {
  return { ok: false, message: '工艺路线不可删除，请使用归档' }
}

export function archiveProcessRoute(id) {
  const row = getProcessRouteById(id)
  if (!row) return { ok: false, message: '工艺路线不存在' }
  if (row.status === '已归档') return { ok: false, message: '该路线已归档' }
  if (row.status !== '使用中' && row.status !== '新建') {
    return { ok: false, message: '仅新建或使用中的路线可归档' }
  }
  row.status = '已归档'
  row.updater = resolveOperatorName()
  row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return { ok: true }
}

export function unarchiveProcessRoute(id) {
  const row = getProcessRouteById(id)
  if (!row) return { ok: false, message: '工艺路线不存在' }
  if (row.status !== '已归档') return { ok: false, message: '仅已归档的路线可取消归档' }
  row.status = '使用中'
  row.updater = resolveOperatorName()
  row.updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return { ok: true }
}

export function cloneProcessRoute(id) {
  const source = getProcessRouteById(id)
  if (!source) return { ok: false, message: '工艺路线不存在' }
  const codes = processRouteState.routes.map((r) => r.code)
  const operator = resolveOperatorName()
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const cloned = {
    ...JSON.parse(JSON.stringify(source)),
    id: `route-${Date.now()}`,
    code: generateProcessRouteCode(codes),
    name: `${source.name}-副本`,
    status: '新建',
    creator: operator,
    updater: operator,
    createdAt: now,
    updatedAt: now,
  }
  processRouteState.routes.unshift(cloned)
  return { ok: true, route: cloned }
}

/** 工单可选路线：使用中 + 范围匹配 */
export function getAvailableRoutesForWorkOrder(ctx = {}) {
  const { productId, productName, materialId, categoryKey } = ctx
  return processRouteState.routes.filter((route) => {
    if (route.status !== '使用中') return false
    if (route.applyScope === '全部产品') return true
    if (route.applyScope === '单个物品') {
      if (route.itemType === '产品' && productId) return route.itemId === productId
      if (route.itemType === '物料' && materialId) return route.itemId === materialId
      if (productName && route.itemName) return route.itemName === productName
      return false
    }
    if (route.applyScope === '物品类别') {
      if (!categoryKey) return true
      return route.categoryKey === categoryKey
    }
    return false
  })
}

export function getActiveRouteOptions(ctx) {
  const routes = getAvailableRoutesForWorkOrder(ctx)
  if (routes.length) return routes.map((r) => r.name)
  return processRouteState.routes.filter((r) => r.status === '使用中').map((r) => r.name)
}
