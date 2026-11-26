import {
  getProcessByName,
  getProcessById,
  resolveDefaultExecutors,
} from '@/store/processConfigStore'
import {
  buildWorkOrderProcessesFromGrid,
  syncStepPolicies,
  COMPLETION_MODE_ALL,
  countGridProcesses,
} from '@/utils/processRouteGrid'
import {
  ROUTE_LAYOUT_TOPOLOGY,
  resolveRouteLayout,
  buildWorkOrderProcessesFromTopology,
} from '@/utils/processRouteTopology'
import { createEmptyWorkOrderProcessExtras } from '@/utils/workOrderProcessDisplay'

function getProcessRouteByNameLazy(name) {
  // 运行时加载，避免 workOrderStore → processRoutes → processRouteStore 循环依赖
  // eslint-disable-next-line global-require
  return require('@/store/processRouteStore').getProcessRouteByName(name)
}

function getActiveRouteOptionsLazy(filters) {
  // eslint-disable-next-line global-require
  return require('@/store/processRouteStore').getActiveRouteOptions(filters)
}

/** @deprecated 兼容旧工单种子；优先走 processRouteStore 网格路线 */
export const processRouteMaster = {
  标准湿法主线: {
    id: 'route-wet-standard',
    name: '标准湿法主线',
    steps: [
      { name: '投料', code: 'GX00000001', hasFeeding: true, resourceType: '工人小组' },
      { name: '升温', code: 'GX00000002', hasFeeding: false, resourceType: '工人' },
      { name: '保温', code: 'GX00000003', hasFeeding: false, resourceType: '工人' },
      { name: '过滤', code: 'GX00000004', hasFeeding: false, resourceType: '工人小组' },
      { name: '灌装', code: 'GX00000006', hasFeeding: false, resourceType: '工人小组' },
    ],
  },
  离心分离主线: {
    id: 'route-centrifuge',
    name: '离心分离主线',
    steps: [
      { name: '投料', code: 'GX00000001', hasFeeding: true, resourceType: '工人小组' },
      { name: '保温', code: 'GX00000003', hasFeeding: false, resourceType: '工人' },
      { name: '离心', code: 'GX00000005', hasFeeding: false, resourceType: '工人小组' },
      { name: '转罐', code: 'GX00000007', hasFeeding: false, resourceType: '工人小组' },
    ],
  },
}

/** 兼容旧拆解演示（流程侧保留转罐收尾） */
export const disassemblyProcessDefs = [
  { name: '转罐', code: 'GX00000007', hasFeeding: false, resourceType: '工人小组' },
  { name: '灌装', code: 'GX00000006', hasFeeding: false, resourceType: '工人小组' },
]

/** 从工艺路线生成工单工序 + 步骤完成方式快照 */
export function buildRouteDispatchSnapshot(routeName) {
  const route = getProcessRouteByNameLazy(routeName)
  // 拓扑路线：按下发快照展开（默认仅主线节点）
  if (route && resolveRouteLayout(route) === ROUTE_LAYOUT_TOPOLOGY) {
    const raw = buildWorkOrderProcessesFromTopology(route.nodes, route.id, getProcessById).filter(
      (row) => row.includeInDispatch !== false,
    )
    const processes = raw.map((step, index) => {
      const proc = getProcessById(step.processId)
      return {
        ...step,
        index: index + 1,
        stepNo: index + 1,
        completionMode: COMPLETION_MODE_ALL,
        processCode: proc?.code || '',
        hasFeeding: Boolean(proc?.operations?.opFeeding),
        isBlanking: Boolean(proc?.isBlanking),
        resourceType: proc?.resourceType || '工人',
        executors: resolveDefaultExecutors(proc),
        ...createEmptyWorkOrderProcessExtras(),
        opOutsource: Boolean(proc?.operations?.opOutsource),
        feedingMaterials: proc?.operations?.opFeeding
          ? [
              {
                id: `feed-${Date.now()}-${index}`,
                materialId: undefined,
                materialName: '',
                qty: null,
              },
            ]
          : [],
      }
    })
    return {
      processes,
      stepPolicies: processes.map((p) => ({
        stepNo: p.stepNo,
        completionMode: COMPLETION_MODE_ALL,
      })),
    }
  }
  if (route && countGridProcesses(route.grid) > 0) {
    const stepPolicies = syncStepPolicies(route.grid, route.stepPolicies)
    return {
      processes: buildWorkOrderProcessesFromGrid(route.grid, route.id, stepPolicies),
      stepPolicies,
    }
  }

  const legacy = processRouteMaster[routeName] || processRouteMaster['标准湿法主线']
  const processes = legacy.steps.map((step, index) => {
    const proc = getProcessByName(step.name)
    return {
      id: `${legacy.id}-step-${index + 1}`,
      index: index + 1,
      stepNo: index + 1,
      rowNo: 1,
      completionMode: COMPLETION_MODE_ALL,
      includeInDispatch: true,
      name: step.name,
      processCode: proc?.code || step.code,
      processId: proc?.id,
      icon: step.icon,
      hasFeeding: step.hasFeeding || Boolean(proc?.operations?.opFeeding),
      isBlanking: Boolean(proc?.isBlanking),
      resourceType: proc?.resourceType || step.resourceType || '工人',
      executors: resolveDefaultExecutors(proc),
      ...createEmptyWorkOrderProcessExtras(),
      opOutsource: Boolean(proc?.operations?.opOutsource),
      feedingMaterials:
        step.hasFeeding || proc?.operations?.opFeeding
          ? [
              {
                id: `feed-${Date.now()}-${index}`,
                materialId: undefined,
                materialName: '',
                qty: null,
              },
            ]
          : [],
    }
  })
  return {
    processes,
    stepPolicies: processes.map((p) => ({
      stepNo: p.stepNo,
      completionMode: COMPLETION_MODE_ALL,
    })),
  }
}

export function buildProcessesFromRoute(routeName) {
  return buildRouteDispatchSnapshot(routeName).processes
}

/** 将路线快照写入工单（工序 + stepPolicies） */
export function applyRouteSnapshotToWorkOrder(workOrder, routeName) {
  if (!workOrder || !routeName) return false
  const snap = buildRouteDispatchSnapshot(routeName)
  workOrder.processRouteName = routeName
  workOrder.processes = snap.processes
  workOrder.stepPolicies = snap.stepPolicies
  return true
}

export function buildDisassemblyProcesses() {
  return disassemblyProcessDefs.map((step, index) => {
    const proc = getProcessByName(step.name)
    return {
      id: `route-disassembly-step-${index + 1}`,
      index: index + 1,
      name: step.name,
      processCode: proc?.code || step.code,
      processId: proc?.id,
      icon: step.icon,
      hasFeeding: step.hasFeeding,
      isBlanking: Boolean(proc?.isBlanking),
      resourceType: proc?.resourceType || step.resourceType,
      executors: resolveDefaultExecutors(proc),
      ...createEmptyWorkOrderProcessExtras(),
      opOutsource: Boolean(proc?.operations?.opOutsource),
      feedingMaterials: [],
    }
  })
}

export function getDefaultProductRoute(productName) {
  if (productName?.includes('离心')) return '离心分离主线'
  if (productName?.includes('回流') || productName?.includes('过滤')) return '带回流过滤主线'
  const opts = getActiveRouteOptionsLazy({ productName })
  return opts[0] || '标准湿法主线'
}

/** 兼容旧引用：转发到 processRouteStore（惰性加载防循环依赖） */
export function getActiveRouteOptions(filters) {
  return getActiveRouteOptionsLazy(filters)
}
