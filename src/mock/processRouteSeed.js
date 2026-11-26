import dayjs from 'dayjs'
import { createEmptyGrid } from '@/utils/processRouteGrid'
import {
  ROUTE_LAYOUT_TOPOLOGY,
  ROUTE_PATH_MAIN,
  ROUTE_PATH_BRANCH,
  ROUTE_PATH_SINK,
  createRouteNode,
} from '@/utils/processRouteTopology'

/** 与 equipmentSeed 对齐的稳定设备 id */
const EQ = {
  R101: 'eq-d-1',
  R201: 'eq-d-2',
  F301: 'eq-d-3',
  C401: 'eq-d-4',
  T501: 'eq-d-5',
  T601: 'eq-d-6',
  P701: 'eq-d-7',
}

/**
 * 纯主线拓扑节点（串行 MOCK）
 * @param {Array<{ key: string, processName: string, equipmentId?: string, category?: string }>} steps
 * @param {(name: string) => string} getProcessIdByName
 */
function buildMainNodes(steps, getProcessIdByName) {
  return steps.map((s, i) =>
    createRouteNode({
      id: `prn-${s.key}`,
      seq: i + 1,
      pathKind: ROUTE_PATH_MAIN,
      processId: getProcessIdByName(s.processName),
      name: s.processName,
      equipmentIds: s.equipmentId ? [s.equipmentId] : [],
      equipmentCategory: s.category || '',
    }),
  )
}

/** 拓扑路线壳：统一 layout / 空 grid */
function topoRoute(partial, nodes) {
  return {
    ...partial,
    layout: ROUTE_LAYOUT_TOPOLOGY,
    nodes,
    grid: createEmptyGrid(),
    stepPolicies: [],
  }
}

/** 流程行业工艺路线种子（全部拓扑，无旧网格） */
export function createProcessRouteSeed(getProcessIdByName) {
  const p = getProcessIdByName
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

  const routes = [
    topoRoute(
      {
        id: 'route-001',
        code: 'GYLX0001',
        name: '标准湿法主线',
        status: '使用中',
        applyScope: '全部产品',
        productDisplay: '',
        remark: '投料→升温→保温→过滤→灌装',
      },
      buildMainNodes(
        [
          { key: 'std-1', processName: '投料', equipmentId: EQ.R101, category: '反应设备' },
          { key: 'std-2', processName: '升温', equipmentId: EQ.R201, category: '反应设备' },
          { key: 'std-3', processName: '保温', equipmentId: EQ.R201, category: '反应设备' },
          { key: 'std-4', processName: '过滤', equipmentId: EQ.F301, category: '分离设备' },
          { key: 'std-5', processName: '灌装', equipmentId: EQ.P701, category: '计量灌装' },
        ],
        p,
      ),
    ),
    topoRoute(
      {
        id: 'route-002',
        code: 'GYLX0002',
        name: '离心分离主线',
        status: '使用中',
        applyScope: '全部产品',
        productDisplay: '',
        remark: '投料→保温→离心→转罐',
      },
      buildMainNodes(
        [
          { key: 'cen-1', processName: '投料', equipmentId: EQ.R101 },
          { key: 'cen-2', processName: '保温', equipmentId: EQ.R201 },
          { key: 'cen-3', processName: '离心', equipmentId: EQ.C401, category: '分离设备' },
          { key: 'cen-4', processName: '转罐', equipmentId: EQ.T501 },
        ],
        p,
      ),
    ),
    topoRoute(
      {
        id: 'route-005',
        code: 'GYLX0005',
        name: '单品湿法定制线',
        status: '使用中',
        applyScope: '单个物品',
        itemType: '产品',
        itemId: 'prod-process-demo-001',
        itemName: '示范湿法成品',
        itemCode: 'CP-PROC-001',
        productDisplay: '示范湿法成品',
        remark: '按单品绑定的精简主线',
      },
      buildMainNodes(
        [
          { key: 'sp-1', processName: '投料', equipmentId: EQ.R201 },
          { key: 'sp-2', processName: '保温', equipmentId: EQ.R201 },
          { key: 'sp-3', processName: '过滤', equipmentId: EQ.F301 },
          { key: 'sp-4', processName: '灌装', equipmentId: EQ.P701 },
        ],
        p,
      ),
    ),
    topoRoute(
      {
        id: 'route-010',
        code: 'GYLX0010',
        name: '湿法串行演示路线',
        status: '使用中',
        applyScope: '全部产品',
        productDisplay: '',
        remark: '纯串行拓扑：投料→升温→保温→过滤→转罐→灌装',
      },
      buildMainNodes(
        [
          { key: 'ser-1', processName: '投料', equipmentId: EQ.R101 },
          { key: 'ser-2', processName: '升温', equipmentId: EQ.R201 },
          { key: 'ser-3', processName: '保温', equipmentId: EQ.R201 },
          { key: 'ser-4', processName: '过滤', equipmentId: EQ.F301 },
          { key: 'ser-5', processName: '转罐', equipmentId: EQ.T501 },
          { key: 'ser-6', processName: '灌装', equipmentId: EQ.P701 },
        ],
        p,
      ),
    ),
    (() => {
      // 沉锂：主线不含压滤；三路洗涤汇到压滤
      const id = {
        slurry: 'prn-lic-slurry',
        acid: 'prn-lic-acid',
        purify1: 'prn-lic-purify1',
        slurry2: 'prn-lic-slurry2',
        precip: 'prn-lic-precip',
        decarb: 'prn-lic-decarb',
        dephos: 'prn-lic-dephos',
        mvr: 'prn-lic-mvr',
        pack: 'prn-lic-pack',
        filter: 'prn-lic-filter',
        fWash: 'prn-lic-fwash',
        caWash: 'prn-lic-cawash',
        liWash: 'prn-lic-liwash',
      }
      return topoRoute(
        {
          id: 'route-012',
          code: 'GYLX0012',
          name: '酸浸沉锂工碳主线（拓扑）',
          status: '使用中',
          applyScope: '单个物品',
          itemType: '产品',
          itemId: 'pi-licarbon',
          itemName: '工业级碳酸锂',
          itemCode: 'FG-LIC-IND',
          productDisplay: '工业级碳酸锂',
          remark:
            '主线投料浆化→酸浸→一次净化→二次浆化→沉锂→脱碳→除磷→MVR→包装；氟渣/钙镁渣/锂盐洗涤汇入压滤（压滤不在主线）。',
        },
        [
          createRouteNode({
            id: id.slurry,
            seq: 1,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('投料浆化'),
            name: '投料浆化',
            equipmentIds: [EQ.R101],
            equipmentCategory: '反应设备',
          }),
          createRouteNode({
            id: id.acid,
            seq: 2,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('一次酸浸'),
            name: '一次酸浸',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
          }),
          createRouteNode({
            id: id.purify1,
            seq: 3,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('一次净化'),
            name: '一次净化',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
            edgeOutLabel: '液',
          }),
          createRouteNode({
            id: id.slurry2,
            seq: 4,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('二次浆化'),
            name: '二次浆化',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
            edgeOutLabel: '液',
          }),
          createRouteNode({
            id: id.precip,
            seq: 5,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('沉锂'),
            name: '沉锂',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
            edgeOutLabel: '液',
          }),
          createRouteNode({
            id: id.decarb,
            seq: 6,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('脱碳'),
            name: '脱碳',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
          }),
          createRouteNode({
            id: id.dephos,
            seq: 7,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('除磷'),
            name: '除磷',
            equipmentIds: [EQ.R201],
            equipmentCategory: '反应设备',
          }),
          createRouteNode({
            id: id.mvr,
            seq: 8,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('MVR浓缩'),
            name: 'MVR浓缩',
            equipmentIds: [EQ.T601],
            equipmentCategory: '分离设备',
          }),
          createRouteNode({
            id: id.pack,
            seq: 9,
            pathKind: ROUTE_PATH_MAIN,
            processId: p('包装'),
            name: '包装',
            equipmentIds: [EQ.P701],
            equipmentCategory: '计量灌装',
          }),
          createRouteNode({
            id: id.filter,
            pathKind: ROUTE_PATH_SINK,
            processId: p('压滤'),
            name: '压滤',
            equipmentIds: [EQ.F301],
            equipmentCategory: '分离设备',
            joinMode: 'all',
          }),
          createRouteNode({
            id: id.fWash,
            pathKind: ROUTE_PATH_BRANCH,
            branchName: '氟渣洗涤',
            processId: p('氟渣洗涤'),
            name: '氟渣洗涤',
            equipmentIds: [EQ.F301],
            equipmentCategory: '分离设备',
            forkAfterNodeId: id.purify1,
            joinToNodeId: id.filter,
            edgeOutLabel: '渣',
          }),
          createRouteNode({
            id: id.caWash,
            pathKind: ROUTE_PATH_BRANCH,
            branchName: '钙镁渣洗涤',
            processId: p('钙镁渣洗涤'),
            name: '钙镁渣洗涤',
            equipmentIds: [EQ.F301],
            equipmentCategory: '分离设备',
            forkAfterNodeId: id.slurry2,
            joinToNodeId: id.filter,
            edgeOutLabel: '渣',
          }),
          createRouteNode({
            id: id.liWash,
            pathKind: ROUTE_PATH_BRANCH,
            branchName: '锂盐洗涤',
            processId: p('锂盐洗涤'),
            name: '锂盐洗涤',
            equipmentIds: [EQ.F301],
            equipmentCategory: '分离设备',
            forkAfterNodeId: id.precip,
            joinToNodeId: id.filter,
            edgeOutLabel: '锂盐',
          }),
        ],
      )
    })(),
  ]

  const creators = ['张工艺', '李工艺', '王工艺', '赵工艺']
  return routes.map((r, i) => {
    const creator = creators[i % creators.length]
    return {
      ...r,
      creator,
      updater: creator,
      createdAt: dayjs('2026-05-01').add(i, 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: now,
    }
  })
}
