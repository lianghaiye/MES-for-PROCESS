/**
 * 演示：网格「并行 + 全部完成」工艺路线 + 待下发工单
 * 路线名：湿法并行演示路线
 */

import dayjs from 'dayjs'
import { buildRouteDispatchSnapshot } from '@/mock/processRoutes'
import { createEmptyGrid, syncStepPolicies } from '@/utils/processRouteGrid'
import { processConfigState } from '@/store/processConfigStore'
import { syncWorkOrderBlankingMaterials } from '@/utils/blankingSettleMaterial'

function getProcessRouteState() {
  // 惰性加载，避免 processRouteStore ↔ 本文件循环依赖
  // eslint-disable-next-line global-require
  return require('@/store/processRouteStore').processRouteState
}

export const PARALLEL_ROUTE_DEMO_NAME = '湿法并行演示路线'
export const PARALLEL_ROUTE_DEMO_ID = 'route-011'
export const PARALLEL_ROUTE_DISPATCH_WO_ID = 'wo-parallel-route-dispatch-001'
export const PARALLEL_ROUTE_DISPATCH_WO_CODE = 'SCGD20261008002'

const EQ = {
  R101: 'eq-d-1',
  F301: 'eq-d-3',
  C401: 'eq-d-4',
  T501: 'eq-d-5',
  P701: 'eq-d-7',
}

function getProcessIdByName(name) {
  const proc = processConfigState.processes.find((p) => p.name === name)
  return proc?.id || `proc-unknown-${name}`
}

function cell(processId, extra = {}) {
  const row = { processId }
  if (extra.processFileId) row.processFileId = extra.processFileId
  if (extra.equipmentId) row.equipmentId = extra.equipmentId
  if (extra.qcOverride) row.qcOverride = extra.qcOverride
  return row
}

function buildParallelDemoGrid() {
  const p = getProcessIdByName
  const pairs = [
    [1, 1, p('投料'), { processFileId: 'pdoc-001', equipmentId: EQ.R101 }],
    // 演示：本路线不检（相对串行演示路线过滤「继承工序」）
    [2, 1, p('过滤'), { processFileId: 'pdoc-003', equipmentId: EQ.F301, qcOverride: 'off' }],
    [2, 2, p('离心'), { processFileId: 'pdoc-004', equipmentId: EQ.C401 }],
    [3, 1, p('转罐'), { equipmentId: EQ.T501 }],
    [4, 1, p('灌装'), { processFileId: 'pdoc-005', equipmentId: EQ.P701 }],
  ]
  const grid = createEmptyGrid(4, 2)
  pairs.forEach(([step, row, processId, extra]) => {
    grid[step - 1][row - 1] = cell(processId, extra)
  })
  return grid
}

function buildParallelDemoRoute() {
  const grid = buildParallelDemoGrid()
  const stepPolicies = syncStepPolicies(grid, [
    { stepNo: 1, completionMode: 'all' },
    { stepNo: 2, completionMode: 'all' },
    { stepNo: 3, completionMode: 'all' },
    { stepNo: 4, completionMode: 'all' },
  ])
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return {
    id: PARALLEL_ROUTE_DEMO_ID,
    code: 'GYLX0011',
    name: PARALLEL_ROUTE_DEMO_NAME,
    status: '使用中',
    applyScope: '全部产品',
    productDisplay: '',
    remark: '第2步过滤/离心并行；过滤「本路线不检」。对照串行演示路线过滤「继承工序」',
    grid,
    stepPolicies,
    creator: '李工艺',
    updater: '李工艺',
    createdAt: '2026-10-08 10:30:00',
    updatedAt: now,
  }
}

/** 确保工艺路线列表中有并行演示路线（覆盖同 id/name） */
export function ensureParallelRouteDemo() {
  try {
    const route = buildParallelDemoRoute()
    const list = getProcessRouteState().routes
    const idx = list.findIndex((r) => r.id === route.id || r.name === route.name)
    if (idx === -1) list.unshift(route)
    else list[idx] = { ...list[idx], ...route }
  } catch (e) {
    console.warn('[parallelRouteDispatchDemoSeed] ensure route failed', e)
  }
}

function createParallelRouteDispatchDemoOrder() {
  ensureParallelRouteDemo()
  const snap = buildRouteDispatchSnapshot(PARALLEL_ROUTE_DEMO_NAME)
  const today = dayjs().format('YYYY-MM-DD')
  const end = dayjs().add(14, 'day').format('YYYY-MM-DD')

  const wo = {
    id: PARALLEL_ROUTE_DISPATCH_WO_ID,
    code: PARALLEL_ROUTE_DISPATCH_WO_CODE,
    name: '湿法成品并行演示批指令工单',
    productName: '示范湿法成品',
    materialCode: 'CP-PROC-001',
    orderCategory: '生产工单',
    status: '待下发',
    scheduleQty: 20,
    planQty: 20,
    workCenter: '分离车间',
    bom: '示范湿法成品',
    bomId: '',
    bomLabel: '示范湿法成品',
    warehouse: '成品仓',
    urgency: '正常',
    planDateRange: [today, end],
    remark: '演示：工艺路线「湿法并行演示路线」；第2步过滤+离心并行（全部完成）',
    processRouteName: PARALLEL_ROUTE_DEMO_NAME,
    source: 'parallel-route-dispatch-demo',
    sourceOrderNo: 'SO20261008002',
    owner: 'admin1',
    processes: (snap.processes || []).map((p) => ({
      ...p,
      executors: [],
    })),
    stepPolicies: snap.stepPolicies || [],
    scheduleBatches: [],
    activeScheduleBatchId: '',
    createdAt: today,
  }
  syncWorkOrderBlankingMaterials(wo)
  return wo
}

/** 写入/覆盖待下发并行路线演示工单 */
export function ensureParallelRouteDispatchDemoWorkOrders(orders) {
  try {
    ensureParallelRouteDemo()
    const list = Array.isArray(orders) ? [...orders] : []
    const demo = createParallelRouteDispatchDemoOrder()
    const idx = list.findIndex((o) => o.id === demo.id || o.code === demo.code)
    if (idx === -1) list.unshift(demo)
    else list[idx] = { ...list[idx], ...demo, id: demo.id }
    return list
  } catch (e) {
    console.warn('[parallelRouteDispatchDemoSeed] ensure wo failed', e)
    return Array.isArray(orders) ? orders : []
  }
}
