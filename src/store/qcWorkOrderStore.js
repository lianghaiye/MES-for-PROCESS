import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { buildRouteDispatchSnapshot, getDefaultProductRoute } from '@/mock/processRoutes'
import {
  resolveOrderField,
  generateQcWorkOrderCode,
  generateQcWorkOrderName,
} from '@/utils/workOrderNaming'
import { resolveDefaultWarehouseByProductName } from '@/utils/warehouseResolver'
import { createLaborDemoQcOrders, isLaborDemoWorkOrder } from '@/mock/laborHourDemoSeed'
import { persistJson } from '@/utils/safeStorage'
import { normalizeUrgency } from '@/constants/urgency'

const STORAGE_KEY = 'i_doms_qc_work_orders'
const SEED_VERSION_KEY = 'i_doms_qc_work_orders_seed_v'
const CURRENT_SEED_VERSION = '2'
let codeSeq = 1

function shouldReseed() {
  try {
    return localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION
  } catch {
    return true
  }
}

function markSeeded() {
  try {
    localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
  } catch {
    /* ignore */
  }
}

function loadFromStorage() {
  if (shouldReseed()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.orders)) return parsed.orders
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  persistJson(STORAGE_KEY, { orders: qcWorkOrderState.orders })
}

/** ZJGD + 6位年月日 + 3位流水，如 ZJGD20250528001 */
function generateQcCode() {
  return `ZJGD${dayjs().format('YYYYMMDD')}${String(codeSeq++).padStart(3, '0')}`
}

function ensureLaborDemoQcOrders(orders) {
  const demos = createLaborDemoQcOrders()
  const rest = orders.filter((o) => !isLaborDemoWorkOrder(o.id))
  return [...demos, ...rest]
}

function createInitialOrders() {
  // 流程改造：质检工单演示清空离散机加件；劳动工时演示仍可叠加
  return ensureLaborDemoQcOrders([])
}

export const qcWorkOrderState = reactive({
  orders: (() => {
    const orders = ensureLaborDemoQcOrders(loadFromStorage() || createInitialOrders())
    markSeeded()
    return orders
  })(),
})

watch(
  () => qcWorkOrderState.orders,
  () => persist(),
  { deep: true },
)

export function addQcWorkOrder(order) {
  qcWorkOrderState.orders.unshift(order)
}

export function deleteQcWorkOrder(id) {
  const idx = qcWorkOrderState.orders.findIndex((o) => o.id === id)
  if (idx === -1) return false
  qcWorkOrderState.orders.splice(idx, 1)
  return true
}

export function cloneQcWorkOrder(id) {
  const source = qcWorkOrderState.orders.find((o) => o.id === id)
  if (!source) return null
  const cloned = JSON.parse(JSON.stringify(source))
  cloned.id = `qc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  cloned.code = generateQcCode()
  cloned.name = `${source.productName}质检工单`
  cloned.status = '待下发'
  cloned.execStatus = '未开始'
  cloned.createdAt = dayjs().format('YYYY-MM-DD')
  cloned.source = 'manual'
  addQcWorkOrder(cloned)
  return cloned
}

export function updateQcWorkOrder(id, patch) {
  const idx = qcWorkOrderState.orders.findIndex((o) => o.id === id)
  if (idx === -1) return null
  Object.assign(qcWorkOrderState.orders[idx], patch)
  return qcWorkOrderState.orders[idx]
}

export function createQcWorkOrderPayload(partial) {
  const routeName = partial.processRouteName || getDefaultProductRoute(partial.productName)
  const routeSnap = buildRouteDispatchSnapshot(routeName)
  const productName = partial.productName?.trim() || ''
  const existingCodes = qcWorkOrderState.orders.map((o) => o.code)
  const code = resolveOrderField(partial.code, () => generateQcWorkOrderCode(existingCodes))
  const name = resolveOrderField(partial.name, () => generateQcWorkOrderName(productName))
  return {
    id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    code,
    name,
    productName,
    orderCategory: '质检工单',
    status: '待下发',
    execStatus: '未开始',
    scheduleQty: partial.scheduleQty ?? partial.planQty ?? 0,
    planQty: partial.planQty ?? 0,
    workCenter: partial.workCenter || '质检中心',
    bom: partial.bom || productName,
    warehouse: partial.warehouse || resolveDefaultWarehouseByProductName(productName) || '',
    urgency: normalizeUrgency(partial.urgency),
    planDateRange: partial.planDateRange || [
      dayjs().format('YYYY-MM-DD'),
      dayjs().add(14, 'day').format('YYYY-MM-DD'),
    ],
    remark: partial.remark || '',
    processRouteName: routeName,
    source: partial.source || 'manual',
    sourceOrderNo: partial.sourceOrderNo || '',
    processes: routeSnap.processes,
    stepPolicies: routeSnap.stepPolicies,
    createdAt: dayjs().format('YYYY-MM-DD'),
  }
}

export function filterQcWorkOrders(list, filters) {
  return list.filter((wo) => {
    if (filters.code && !wo.code.includes(filters.code)) return false
    if (filters.name && !wo.name.includes(filters.name)) return false
    if (filters.salesOrderNo && !(wo.sourceOrderNo || '').includes(filters.salesOrderNo))
      return false
    if (filters.status && wo.status !== filters.status) return false
    if (filters.execStatus && wo.execStatus !== filters.execStatus) return false
    if (filters.orderCategory && wo.orderCategory !== filters.orderCategory) return false
    if (filters.workCenter && wo.workCenter !== filters.workCenter) return false
    return true
  })
}

export function canShowQcDispatchTab(status) {
  return status === '待下发'
}
