import {
  getProcessById,
  getOperationLabels,
  resolveDefaultExecutors,
  formatProcessResponsible,
  formatProcessEquipment,
  resolveRouteGate,
  resolveRouteTransfer,
  isCustomRouteGate,
  formatProcessGate,
} from '@/store/processConfigStore'
import { normalizeReportMode } from '@/utils/reportMode'
import { normalizeTaskExecutionMode } from '@/utils/taskExecutionMode'
import { getProcessDocById } from '@/store/processDocStore'
import { createEmptyWorkOrderProcessExtras } from '@/utils/workOrderProcessDisplay'

export const MAX_ROUTE_STEPS = 150
export const MAX_ROUTE_PARALLEL = 50

/** 步骤完成方式：全部完成 | 选做完成 */
export const COMPLETION_MODE_ALL = 'all'
export const COMPLETION_MODE_ANY = 'any'
export const COMPLETION_MODE_OPTIONS = [
  { value: COMPLETION_MODE_ALL, label: '全部完成' },
  { value: COMPLETION_MODE_ANY, label: '选做完成' },
]

/**
 * 本路线质检覆盖（挂在网格 cell，非工序主数据）
 * 仅当工序主数据已配置质检时可选：
 * - inherit：继承工序主数据质检配置
 * - off：本路线不质检
 */
export const ROUTE_QC_INHERIT = 'inherit'
export const ROUTE_QC_OFF = 'off'
export const ROUTE_QC_OVERRIDE_OPTIONS = [
  { value: ROUTE_QC_INHERIT, label: '继承工序' },
  { value: ROUTE_QC_OFF, label: '本路线不检' },
]

export function normalizeRouteQcOverride(value) {
  if (value === ROUTE_QC_OFF || value === 'off') return ROUTE_QC_OFF
  // 历史「本路线要检 / force」归一为继承
  return ROUTE_QC_INHERIT
}

export function formatRouteQcOverrideLabel(value) {
  const mode = normalizeRouteQcOverride(value)
  return ROUTE_QC_OVERRIDE_OPTIONS.find((o) => o.value === mode)?.label || '继承工序'
}

/** 工序调度策略：一期仅手动调度 */
export const DISPATCH_STRATEGY_MANUAL = 'manual'
export const DISPATCH_STRATEGY_LABELS = {
  [DISPATCH_STRATEGY_MANUAL]: '手动调度',
}

export function formatDispatchStrategyLabel(strategy) {
  return DISPATCH_STRATEGY_LABELS[strategy] || DISPATCH_STRATEGY_LABELS[DISPATCH_STRATEGY_MANUAL]
}

export function normalizeCompletionMode(mode) {
  return mode === COMPLETION_MODE_ANY ? COMPLETION_MODE_ANY : COMPLETION_MODE_ALL
}

export function formatCompletionModeLabel(mode) {
  return normalizeCompletionMode(mode) === COMPLETION_MODE_ANY ? '选做完成' : '全部完成'
}

/** 按网格列数对齐 stepPolicies，缺省为全部完成 */
export function syncStepPolicies(grid, policies) {
  const g = normalizeGrid(grid)
  const prev = Array.isArray(policies) ? policies : []
  return g.map((_, i) => {
    const stepNo = i + 1
    const found = prev.find((p) => Number(p?.stepNo) === stepNo) || prev[i]
    return {
      stepNo,
      completionMode: normalizeCompletionMode(found?.completionMode),
    }
  })
}

export function getCompletionModeAt(policies, stepIndex) {
  const stepNo = Number(stepIndex) + 1
  const found =
    (policies || []).find((p) => Number(p?.stepNo) === stepNo) || (policies || [])[stepIndex]
  return normalizeCompletionMode(found?.completionMode)
}

export function insertStepPolicyAfter(policies, afterIndex) {
  const list = (policies || []).map((p, i) => ({
    stepNo: i + 1,
    completionMode: normalizeCompletionMode(p?.completionMode),
  }))
  const idx = Math.max(-1, Math.min(Number(afterIndex), list.length - 1))
  list.splice(idx + 1, 0, { stepNo: 0, completionMode: COMPLETION_MODE_ALL })
  return list.map((p, i) => ({
    stepNo: i + 1,
    completionMode: normalizeCompletionMode(p.completionMode),
  }))
}

export function removeStepPolicyAt(policies, index) {
  const list = (policies || []).map((p, i) => ({
    stepNo: i + 1,
    completionMode: normalizeCompletionMode(p?.completionMode),
  }))
  const idx = Number(index)
  if (idx < 0 || idx >= list.length || list.length <= 1) {
    return list
  }
  list.splice(idx, 1)
  return list.map((p, i) => ({
    stepNo: i + 1,
    completionMode: normalizeCompletionMode(p.completionMode),
  }))
}

/** 某步有效工序数 */
export function countProcessesInStep(grid, stepIndex) {
  return (grid?.[stepIndex] || []).filter((cell) => cell?.processId).length
}

/** 网格：steps[stepIndex].rows[rowIndex] = cell | null */
export function createEmptyGrid(stepCount = 9, rowCount = 2) {
  return Array.from({ length: stepCount }, () => Array.from({ length: rowCount }, () => null))
}

/** 本格候选设备：优先 equipmentIds，兼容历史单字段 equipmentId */
export function normalizeCellEquipmentIds(cell) {
  if (!cell) return []
  const fromArr = Array.isArray(cell.equipmentIds)
    ? cell.equipmentIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []
  if (fromArr.length) {
    const seen = new Set()
    return fromArr.filter((id) => {
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }
  const legacy = String(cell.equipmentId || '').trim()
  return legacy ? [legacy] : []
}

export function normalizeRouteCell(cell) {
  if (!cell) return null
  const equipmentIds = normalizeCellEquipmentIds(cell)
  return {
    ...cell,
    equipmentCategory: String(cell.equipmentCategory || '').trim(),
    equipmentIds,
    // 兼容仍读单字段的下游
    equipmentId: equipmentIds[0] || '',
  }
}

export function normalizeGrid(grid) {
  if (!Array.isArray(grid) || !grid.length) {
    return createEmptyGrid()
  }
  return grid.map((step) =>
    Array.isArray(step) ? step.map((cell) => (cell ? normalizeRouteCell(cell) : null)) : [],
  )
}

/** 在 afterIndex（0-based）之后插入一列空步；afterIndex === -1 插到最前 */
export function insertStepAfter(grid, afterIndex) {
  const g = normalizeGrid(grid)
  const rows = Math.max(1, g[0]?.length || 1)
  if (g.length >= MAX_ROUTE_STEPS) return g
  const empty = Array.from({ length: rows }, () => null)
  const idx = Math.max(-1, Math.min(Number(afterIndex), g.length - 1))
  g.splice(idx + 1, 0, empty)
  return g
}

/** 在每步的 afterIndex 之后插入空行；afterIndex === -1 插到最上 */
export function insertRowAfter(grid, afterIndex) {
  const g = normalizeGrid(grid)
  const rows = Math.max(1, g[0]?.length || 1)
  if (rows >= MAX_ROUTE_PARALLEL) return g
  const idx = Math.max(-1, Math.min(Number(afterIndex), rows - 1))
  g.forEach((step) => {
    step.splice(idx + 1, 0, null)
  })
  return g
}

/** 删除指定步（列）；至少保留 1 步 */
export function removeStepAt(grid, index) {
  const g = normalizeGrid(grid)
  if (g.length <= 1) return g
  const idx = Number(index)
  if (idx < 0 || idx >= g.length) return g
  g.splice(idx, 1)
  return g
}

/** 删除指定行；至少保留 1 行 */
export function removeRowAt(grid, index) {
  const g = normalizeGrid(grid)
  const rows = Math.max(1, g[0]?.length || 1)
  if (rows <= 1) return g
  const idx = Number(index)
  if (idx < 0 || idx >= rows) return g
  g.forEach((step) => {
    step.splice(idx, 1)
  })
  return g
}

export function countGridSteps(grid) {
  return (grid || []).filter((step) => step?.some((cell) => cell?.processId)).length
}

/** 网格中已配置的工序格数量 */
export function countGridProcesses(grid) {
  let n = 0
  for (const step of grid || []) {
    for (const cell of step || []) {
      if (cell?.processId) n += 1
    }
  }
  return n
}

export function countGridParallel(grid) {
  let max = 0
  for (const step of grid || []) {
    const n = (step || []).filter((cell) => cell?.processId).length
    max = Math.max(max, n)
  }
  return max
}

export function validateProcessRouteGrid(grid) {
  const steps = countGridSteps(grid)
  const parallel = countGridParallel(grid)
  if (steps > MAX_ROUTE_STEPS) {
    return { ok: false, message: `工序步数不能超过 ${MAX_ROUTE_STEPS}` }
  }
  if (parallel > MAX_ROUTE_PARALLEL) {
    return { ok: false, message: `并行工序数不能超过 ${MAX_ROUTE_PARALLEL}` }
  }
  if (steps === 0) {
    return { ok: false, message: '请至少配置一个工序步骤' }
  }
  return { ok: true }
}

export function normalizeCellReturns(returns) {
  if (!Array.isArray(returns)) return []
  return returns.map((item) => ({
    stream: String(item?.stream || '').trim(),
    toStep: Number(item?.toStep) || 0,
    toRow: Number(item?.toRow) || 0,
  }))
}

export function formatCellReturn(grid, item) {
  const stream = item?.stream || '物流'
  if (!item?.toStep || !item?.toRow) return `${stream} → 未指定`
  const cell = grid?.[item.toStep - 1]?.[item.toRow - 1]
  const proc = cell?.processId ? getProcessById(cell.processId) : null
  const name = proc?.name || cell?.processName || ''
  return `${stream} → 第${item.toStep}列第${item.toRow}行${name ? ` ${name}` : ''}`
}

export function validateCellReturns(grid) {
  const filled = new Set()
  ;(grid || []).forEach((step, stepIndex) => {
    ;(step || []).forEach((cell, rowIndex) => {
      if (cell?.processId) filled.add(`${stepIndex + 1}-${rowIndex + 1}`)
    })
  })
  for (let stepIndex = 0; stepIndex < (grid || []).length; stepIndex += 1) {
    const step = grid[stepIndex] || []
    for (let rowIndex = 0; rowIndex < step.length; rowIndex += 1) {
      const cell = step[rowIndex]
      if (!cell?.processId) continue
      for (const item of normalizeCellReturns(cell.returns)) {
        const where = `第${stepIndex + 1}列第${rowIndex + 1}行`
        if (!item.stream) return { ok: false, message: `${where}的回流要填写物流名称` }
        if (!item.toStep || !item.toRow)
          return { ok: false, message: `${where}的回流要选择回到哪一格` }
        if (item.toStep === stepIndex + 1 && item.toRow === rowIndex + 1) {
          return { ok: false, message: `${where}不能回流到自己` }
        }
        if (!filled.has(`${item.toStep}-${item.toRow}`)) {
          return { ok: false, message: `${where}的回流目标不存在` }
        }
      }
    }
  }
  return { ok: true }
}

/** 路线上挂过的设备。传 processId 时只取该工序那几格。 */
export function collectRouteEquipmentIds(route, processId = '') {
  const ids = []
  const seen = new Set()
  const push = (id) => {
    const equipmentId = String(id || '').trim()
    if (!equipmentId || seen.has(equipmentId)) return
    seen.add(equipmentId)
    ids.push(equipmentId)
  }
  ;(route?.grid || []).forEach((step) => {
    ;(step || []).forEach((cell) => {
      if (!cell?.processId) return
      if (processId && cell.processId !== processId) return
      normalizeCellEquipmentIds(cell).forEach(push)
    })
  })
  if (!ids.length && !processId) {
    ;(route?.units || []).forEach((unit) => push(unit.equipmentId))
  }
  return ids
}

export function unitsFromGrid(grid) {
  const ids = []
  const seen = new Set()
  ;(grid || []).forEach((step) => {
    ;(step || []).forEach((cell) => {
      normalizeCellEquipmentIds(cell).forEach((equipmentId) => {
        if (!equipmentId || seen.has(equipmentId)) return
        seen.add(equipmentId)
        ids.push({ equipmentId })
      })
    })
  })
  return ids
}

export function flattenGridToSteps(grid, stepPolicies = null) {
  const policies = syncStepPolicies(grid, stepPolicies)
  const modeByStep = new Map(policies.map((p) => [p.stepNo, p.completionMode]))
  const result = []
  ;(grid || []).forEach((stepRows, stepIndex) => {
    ;(stepRows || []).forEach((cell, rowIndex) => {
      if (!cell?.processId) return
      const proc = getProcessById(cell.processId)
      const doc = cell.processFileId ? getProcessDocById(cell.processFileId) : null
      const stepNo = stepIndex + 1
      result.push({
        stepNo,
        rowNo: rowIndex + 1,
        colNo: stepIndex + 1,
        completionMode: modeByStep.get(stepNo) || COMPLETION_MODE_ALL,
        processId: cell.processId,
        processCode: proc?.code || '',
        name: proc?.name || cell.processName || '',
        icon: proc?.icon || 'ToolOutlined',
        hasFeeding: Boolean(proc?.operations?.opFeeding || proc?.hasFeeding),
        isBlanking: Boolean(proc?.isBlanking),
        opOutsource: Boolean(proc?.operations?.opOutsource),
        resourceType: proc?.resourceType || '工人',
        reportMode: normalizeReportMode(proc?.reportMode),
        taskExecutionMode: normalizeTaskExecutionMode(proc?.taskExecutionMode),
        processFileId: cell.processFileId || '',
        processFileName: doc?.name || cell.processFileName || '',
        routeQcOverride: normalizeRouteQcOverride(cell.qcOverride),
        gateMode: resolveRouteGate(proc, cell),
        gateCustom: isCustomRouteGate(cell),
        transferCondition: resolveRouteTransfer(proc, cell),
        transferCustom: Boolean(cell.transferCustom),
        equipmentCategory: String(cell.equipmentCategory || '').trim(),
        equipmentIds: normalizeCellEquipmentIds(cell),
        equipmentId: normalizeCellEquipmentIds(cell)[0] || '',
        returns: normalizeCellReturns(cell.returns),
        returnText:
          normalizeCellReturns(cell.returns)
            .map((item) => formatCellReturn(grid, item))
            .join('；') || '',
      })
    })
  })
  return result.sort((a, b) => a.stepNo - b.stepNo || a.rowNo - b.rowNo)
}

/** 转为工单工序结构 */
export function buildWorkOrderProcessesFromGrid(grid, routeId = '', stepPolicies = null) {
  const policies = syncStepPolicies(grid, stepPolicies)
  const flat = flattenGridToSteps(grid, policies)
  return flat.map((step, index) => ({
    id: `${routeId}-step-${step.stepNo}-${step.rowNo}`,
    index: index + 1,
    stepNo: step.stepNo,
    rowNo: step.rowNo,
    completionMode: step.completionMode || COMPLETION_MODE_ALL,
    includeInDispatch: true,
    name: step.name,
    processCode: step.processCode,
    processId: step.processId,
    icon: step.icon,
    hasFeeding: step.hasFeeding,
    isBlanking: Boolean(step.isBlanking),
    resourceType: step.resourceType,
    reportMode: step.reportMode || '',
    taskExecutionMode: step.taskExecutionMode || 'single_claim',
    processFileId: step.processFileId,
    processFileName: step.processFileName,
    routeQcOverride: normalizeRouteQcOverride(step.routeQcOverride),
    gateMode: step.gateMode,
    gateCustom: Boolean(step.gateCustom),
    transferCondition: step.transferCondition || '',
    transferCustom: Boolean(step.transferCustom),
    executors: resolveDefaultExecutors(getProcessById(step.processId)),
    ...createEmptyWorkOrderProcessExtras(),
    opOutsource: Boolean(step.opOutsource),
    feedingMaterials: step.hasFeeding
      ? [{ id: `feed-${Date.now()}-${index}`, materialId: undefined, materialName: '', qty: null }]
      : [],
  }))
}

/** 下发页：需要勾选的「选做完成」步（工序数 ≥ 2） */
export function listAnyCompletionSteps(processes) {
  const byStep = new Map()
  for (const p of processes || []) {
    const stepNo = Number(p.stepNo)
    if (!Number.isFinite(stepNo) || stepNo < 1) continue
    if (!byStep.has(stepNo)) byStep.set(stepNo, [])
    byStep.get(stepNo).push(p)
  }
  const groups = []
  for (const [stepNo, list] of byStep) {
    const mode = normalizeCompletionMode(list[0]?.completionMode)
    if (mode === COMPLETION_MODE_ANY && list.length >= 2) {
      groups.push({ stepNo, processes: list })
    }
  }
  return groups.sort((a, b) => a.stepNo - b.stepNo)
}

export function validateDispatchProcessSelection(processes) {
  for (const group of listAnyCompletionSteps(processes)) {
    const selected = group.processes.filter((p) => p.includeInDispatch !== false)
    if (!selected.length) {
      return {
        ok: false,
        message: `第 ${group.stepNo} 步为选做完成，请至少选择一道工序`,
      }
    }
  }
  return { ok: true }
}

/** 下发时过滤：选做步仅保留勾选项；全部完成步全留 */
export function applyDispatchProcessFilter(processes) {
  const anyStepNos = new Set(listAnyCompletionSteps(processes).map((g) => g.stepNo))
  const filtered = (processes || []).filter((p) => {
    const stepNo = Number(p.stepNo)
    if (!anyStepNos.has(stepNo)) return true
    return p.includeInDispatch !== false
  })
  return filtered.map((p, index) => ({
    ...p,
    index: index + 1,
    includeInDispatch: true,
  }))
}

export function getSelectedCellMeta(grid, stepIndex, rowIndex) {
  const cell = grid?.[stepIndex]?.[rowIndex]
  if (!cell?.processId) return null
  const proc = getProcessById(cell.processId)
  const configLabels = [...(proc?.isBlanking ? ['下料'] : []), ...getOperationLabels(proc)]
  const masterHasQc = Boolean(
    proc?.operations?.opQc ||
    (Array.isArray(proc?.qcConfigs) && proc.qcConfigs.some((c) => c?.enabled !== false)),
  )
  return {
    stepNo: stepIndex + 1,
    rowNo: rowIndex + 1,
    colNo: stepIndex + 1,
    processName: proc?.name || cell.processName || '',
    processCode: proc?.code || '',
    processId: cell.processId,
    processFileId: cell.processFileId || undefined,
    qcOverride: normalizeRouteQcOverride(cell.qcOverride),
    masterHasQc,
    resourceType: proc?.resourceType || '',
    reportMode: proc?.reportMode || '',
    category: proc?.category || '',
    equipmentText: formatProcessEquipment(proc),
    equipmentCategory: String(cell.equipmentCategory || '').trim(),
    equipmentIds: normalizeCellEquipmentIds(cell),
    equipmentId: normalizeCellEquipmentIds(cell)[0] || '',
    returns: normalizeCellReturns(cell.returns),
    responsibleText: formatProcessResponsible(proc),
    instruction: proc?.instruction || '',
    gateChoice: isCustomRouteGate(cell) ? cell.gateMode : 'inherit',
    effectiveGate: resolveRouteGate(proc, cell),
    effectiveGateLabel: formatProcessGate(resolveRouteGate(proc, cell)),
    gateCustom: isCustomRouteGate(cell),
    defaultGateLabel: formatProcessGate(proc?.gateMode),
    transferCustom: Boolean(cell.transferCustom),
    transferDraft: cell?.transferCustom
      ? cell.transferCondition || ''
      : proc?.transferCondition || '',
    defaultTransfer: proc?.transferCondition || '',
    isBlanking: Boolean(proc?.isBlanking),
    configLabels,
    dispatchStrategy: DISPATCH_STRATEGY_MANUAL,
    dispatchStrategyLabel: formatDispatchStrategyLabel(DISPATCH_STRATEGY_MANUAL),
  }
}

/** 列表/详情展示用 */
export function formatApplyScopeLabel(scope) {
  const map = {
    全部产品: '全局',
    单个物品: '单产品',
    物品类别: '产品类别',
  }
  return map[scope] || scope || '—'
}
