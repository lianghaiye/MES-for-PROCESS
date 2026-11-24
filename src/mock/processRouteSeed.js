import dayjs from 'dayjs'
import { createEmptyGrid } from '@/utils/processRouteGrid'

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

function cell(processId, extra = {}) {
  if (!processId) return null
  const row = { processId }
  if (typeof extra === 'string') {
    if (extra) row.processFileId = extra
    return row
  }
  if (extra.processFileId) row.processFileId = extra.processFileId
  const equipmentIds = Array.isArray(extra.equipmentIds)
    ? extra.equipmentIds.filter(Boolean)
    : extra.equipmentId
      ? [extra.equipmentId]
      : []
  if (equipmentIds.length) row.equipmentIds = equipmentIds
  if (extra.equipmentCategory) row.equipmentCategory = extra.equipmentCategory
  if (Array.isArray(extra.returns) && extra.returns.length) {
    row.returns = extra.returns.map((item) => ({ ...item }))
  }
  if (extra.qcOverride) row.qcOverride = extra.qcOverride
  return row
}

function buildGrid(pairs) {
  const maxStep = Math.max(...pairs.map(([s]) => s), 0)
  const maxRow = Math.max(...pairs.map(([, r]) => r), 0)
  const grid = createEmptyGrid(maxStep, maxRow)
  pairs.forEach(([step, row, processId, extra]) => {
    grid[step - 1][row - 1] = cell(processId, extra || {})
  })
  return grid
}

/** 流程行业工艺路线种子 */
export function createProcessRouteSeed(getProcessIdByName) {
  const p = getProcessIdByName
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

  const routes = [
    {
      id: 'route-001',
      code: 'GYLX0001',
      name: '标准湿法主线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '投料→升温→保温→过滤→灌装，通用湿法主线',
      grid: buildGrid([
        [1, 1, p('投料'), { processFileId: 'pdoc-001', equipmentId: EQ.R101 }],
        [2, 1, p('升温'), { processFileId: 'pdoc-002', equipmentId: EQ.R201 }],
        [3, 1, p('保温'), { processFileId: 'pdoc-002', equipmentId: EQ.R201 }],
        [4, 1, p('过滤'), { processFileId: 'pdoc-003', equipmentId: EQ.F301 }],
        [5, 1, p('灌装'), { processFileId: 'pdoc-005', equipmentId: EQ.P701 }],
      ]),
    },
    {
      id: 'route-002',
      code: 'GYLX0002',
      name: '离心分离主线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '反应后走离心，转入中间罐',
      grid: buildGrid([
        [1, 1, p('投料'), { equipmentId: EQ.R101 }],
        [2, 1, p('保温'), { equipmentId: EQ.R201 }],
        [3, 1, p('离心'), { processFileId: 'pdoc-004', equipmentId: EQ.C401 }],
        [4, 1, p('转罐'), { processFileId: 'pdoc-006', equipmentId: EQ.T501 }],
      ]),
    },
    {
      id: 'route-003',
      code: 'GYLX0003',
      name: '带回流过滤主线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '过滤母液回流至升温格，再转罐灌装',
      grid: buildGrid([
        [1, 1, p('投料'), { equipmentId: EQ.R101 }],
        [2, 1, p('升温'), { equipmentId: EQ.R201 }],
        [3, 1, p('保温'), { equipmentId: EQ.R201 }],
        [
          4,
          1,
          p('过滤'),
          {
            processFileId: 'pdoc-003',
            equipmentId: EQ.F301,
            returns: [{ stream: '母液', toStep: 2, toRow: 1 }],
          },
        ],
        [5, 1, p('转罐'), { equipmentId: EQ.T501 }],
        [6, 1, p('灌装'), { equipmentId: EQ.P701 }],
      ]),
    },
    {
      id: 'route-004',
      code: 'GYLX0004',
      name: '灌装成品线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '中间罐转入成品罐后灌装',
      grid: buildGrid([
        [1, 1, p('转罐'), { equipmentId: EQ.T601 }],
        [2, 1, p('灌装'), { processFileId: 'pdoc-005', equipmentId: EQ.P701 }],
      ]),
    },
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
      grid: buildGrid([
        [1, 1, p('投料'), { equipmentId: EQ.R201 }],
        [2, 1, p('保温'), { equipmentId: EQ.R201 }],
        [3, 1, p('过滤'), { equipmentId: EQ.F301 }],
        [4, 1, p('灌装'), { equipmentId: EQ.P701 }],
      ]),
    },
    {
      id: 'route-006',
      code: 'GYLX0006',
      name: '转罐暂存线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '仅做罐间转移',
      grid: buildGrid([
        [1, 1, p('转罐'), { equipmentId: EQ.T501 }],
        [2, 1, p('转罐'), { equipmentId: EQ.T601 }],
      ]),
    },
    {
      id: 'route-007',
      code: 'GYLX0007',
      name: '过滤灌装短线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      grid: buildGrid([
        [1, 1, p('过滤'), { equipmentId: EQ.F301 }],
        [2, 1, p('灌装'), { equipmentId: EQ.P701 }],
      ]),
    },
    {
      id: 'route-008',
      code: 'GYLX0008',
      name: '历史离心测试线',
      status: '已归档',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '历史测试路线',
      grid: buildGrid([
        [1, 1, p('离心'), { equipmentId: EQ.C401 }],
        [2, 1, p('转罐'), { equipmentId: EQ.T501 }],
      ]),
    },
    {
      id: 'route-009',
      code: 'GYLX0009',
      name: '分离方式选做演示路线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '第2步过滤/离心为选做完成，下发时可勾选',
      grid: buildGrid([
        [1, 1, p('投料'), { equipmentId: EQ.R101 }],
        [2, 1, p('过滤'), { equipmentId: EQ.F301 }],
        [2, 2, p('离心'), { equipmentId: EQ.C401 }],
        [3, 1, p('转罐'), { equipmentId: EQ.T501 }],
        [4, 1, p('灌装'), { equipmentId: EQ.P701 }],
      ]),
      stepPolicies: [
        { stepNo: 1, completionMode: 'all' },
        { stepNo: 2, completionMode: 'any' },
        { stepNo: 3, completionMode: 'all' },
        { stepNo: 4, completionMode: 'all' },
      ],
    },
    {
      id: 'route-010',
      code: 'GYLX0010',
      name: '湿法串行演示路线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '纯串行：投料→升温→保温→过滤→转罐→灌装',
      grid: buildGrid([
        [1, 1, p('投料'), { processFileId: 'pdoc-001', equipmentId: EQ.R101 }],
        [2, 1, p('升温'), { processFileId: 'pdoc-002', equipmentId: EQ.R201 }],
        [3, 1, p('保温'), { equipmentId: EQ.R201 }],
        [4, 1, p('过滤'), { processFileId: 'pdoc-003', equipmentId: EQ.F301 }],
        [5, 1, p('转罐'), { processFileId: 'pdoc-006', equipmentId: EQ.T501 }],
        [6, 1, p('灌装'), { processFileId: 'pdoc-005', equipmentId: EQ.P701 }],
      ]),
      stepPolicies: [
        { stepNo: 1, completionMode: 'all' },
        { stepNo: 2, completionMode: 'all' },
        { stepNo: 3, completionMode: 'all' },
        { stepNo: 4, completionMode: 'all' },
        { stepNo: 5, completionMode: 'all' },
        { stepNo: 6, completionMode: 'all' },
      ],
    },
    {
      id: 'route-011',
      code: 'GYLX0011',
      name: '湿法并行演示路线',
      status: '使用中',
      applyScope: '全部产品',
      productDisplay: '',
      remark: '第2步过滤/离心并行且全部完成；过滤可「本路线不检」对照串行',
      grid: buildGrid([
        [1, 1, p('投料'), { processFileId: 'pdoc-001', equipmentId: EQ.R101 }],
        [2, 1, p('过滤'), { processFileId: 'pdoc-003', equipmentId: EQ.F301, qcOverride: 'off' }],
        [2, 2, p('离心'), { processFileId: 'pdoc-004', equipmentId: EQ.C401 }],
        [3, 1, p('转罐'), { equipmentId: EQ.T501 }],
        [4, 1, p('灌装'), { processFileId: 'pdoc-005', equipmentId: EQ.P701 }],
      ]),
      stepPolicies: [
        { stepNo: 1, completionMode: 'all' },
        { stepNo: 2, completionMode: 'all' },
        { stepNo: 3, completionMode: 'all' },
        { stepNo: 4, completionMode: 'all' },
      ],
    },
    {
      id: 'route-012',
      code: 'GYLX0012',
      name: '酸浸沉锂工碳主线',
      status: '使用中',
      applyScope: '单个物品',
      itemType: '产品',
      itemId: 'pi-licarbon',
      itemName: '工业级碳酸锂',
      itemCode: 'FG-LIC-IND',
      productDisplay: '工业级碳酸锂',
      remark:
        '调研工厂主线：投料浆化→一次酸浸→压滤/洗渣→一次净化→二次浆化→沉锂→锂盐洗涤→离心→包装。前段门禁只记录，后段硬放行。',
      grid: buildGrid([
        [1, 1, p('投料浆化'), { equipmentId: EQ.R101, equipmentCategory: '反应设备' }],
        [2, 1, p('一次酸浸'), { equipmentId: EQ.R201, equipmentCategory: '反应设备' }],
        [3, 1, p('压滤'), { equipmentId: EQ.F301, equipmentCategory: '分离设备' }],
        [3, 2, p('洗渣'), { equipmentId: EQ.F301, equipmentCategory: '分离设备' }],
        [4, 1, p('一次净化'), { equipmentId: EQ.R201, equipmentCategory: '反应设备' }],
        [5, 1, p('二次浆化'), { equipmentId: EQ.R201, equipmentCategory: '反应设备' }],
        [6, 1, p('沉锂'), { equipmentId: EQ.R201, equipmentCategory: '反应设备' }],
        [7, 1, p('锂盐洗涤'), { equipmentId: EQ.F301, equipmentCategory: '分离设备' }],
        [
          8,
          1,
          p('离心'),
          { processFileId: 'pdoc-004', equipmentId: EQ.C401, equipmentCategory: '分离设备' },
        ],
        [9, 1, p('包装'), { equipmentId: EQ.P701, equipmentCategory: '计量灌装' }],
      ]),
      stepPolicies: [
        { stepNo: 1, completionMode: 'all' },
        { stepNo: 2, completionMode: 'all' },
        { stepNo: 3, completionMode: 'all' },
        { stepNo: 4, completionMode: 'all' },
        { stepNo: 5, completionMode: 'all' },
        { stepNo: 6, completionMode: 'all' },
        { stepNo: 7, completionMode: 'all' },
        { stepNo: 8, completionMode: 'all' },
        { stepNo: 9, completionMode: 'all' },
      ],
    },
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
