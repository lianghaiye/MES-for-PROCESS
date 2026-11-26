/**
 * 演示：拓扑支线（过滤/离心分出汇入）+ 待下发工单
 * 路线名：湿法并行演示路线（已改为拓扑，不再用网格并行格）
 */

import dayjs from 'dayjs'
import { buildRouteDispatchSnapshot } from '@/mock/processRoutes'
import { createEmptyGrid } from '@/utils/processRouteGrid'
import {
  ROUTE_LAYOUT_TOPOLOGY,
  ROUTE_PATH_MAIN,
  ROUTE_PATH_BRANCH,
  createRouteNode,
} from '@/utils/processRouteTopology'
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

function buildParallelDemoRoute() {
  const p = getProcessIdByName
  const id = {
    feed: 'prn-par-feed',
    tank: 'prn-par-tank',
    fill: 'prn-par-fill',
    filter: 'prn-par-filter',
    cen: 'prn-par-cen',
  }
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
  return {
    id: PARALLEL_ROUTE_DEMO_ID,
    code: 'GYLX0011',
    name: PARALLEL_ROUTE_DEMO_NAME,
    status: '使用中',
    applyScope: '全部产品',
    productDisplay: '',
    remark: '拓扑：主线投料→转罐→灌装；过滤/离心自投料分出、汇入转罐',
    layout: ROUTE_LAYOUT_TOPOLOGY,
    nodes: [
      createRouteNode({
        id: id.feed,
        seq: 1,
        pathKind: ROUTE_PATH_MAIN,
        processId: p('投料'),
        name: '投料',
        equipmentIds: [EQ.R101],
      }),
      createRouteNode({
        id: id.tank,
        seq: 2,
        pathKind: ROUTE_PATH_MAIN,
        processId: p('转罐'),
        name: '转罐',
        equipmentIds: [EQ.T501],
      }),
      createRouteNode({
        id: id.fill,
        seq: 3,
        pathKind: ROUTE_PATH_MAIN,
        processId: p('灌装'),
        name: '灌装',
        equipmentIds: [EQ.P701],
      }),
      createRouteNode({
        id: id.filter,
        pathKind: ROUTE_PATH_BRANCH,
        branchName: '过滤支线',
        processId: p('过滤'),
        name: '过滤',
        equipmentIds: [EQ.F301],
        forkAfterNodeId: id.feed,
        joinToNodeId: id.tank,
      }),
      createRouteNode({
        id: id.cen,
        pathKind: ROUTE_PATH_BRANCH,
        branchName: '离心支线',
        processId: p('离心'),
        name: '离心',
        equipmentIds: [EQ.C401],
        forkAfterNodeId: id.feed,
        joinToNodeId: id.tank,
      }),
    ],
    grid: createEmptyGrid(),
    stepPolicies: [],
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
    remark: '演示：工艺路线「湿法并行演示路线」拓扑主线；过滤/离心为支线',
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
