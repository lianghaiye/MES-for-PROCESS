import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import {
  createProcessConfigSeed,
  PROCESS_OPERATION_DEFS,
  REPORT_MODES,
  TASK_EXECUTION_MODES,
  RESOURCE_TYPES,
  MOCK_POSITIONS,
  PROCESS_RESPONSIBLE_OPTIONS,
  formatProcessResponsible,
  PROCESS_GATE_OPTIONS,
  PROCESS_GATE_RECORD,
  PROCESS_GATE_HARD,
  PROCESS_GATE_INHERIT,
  normalizeProcessGate,
  formatProcessGate,
  isCustomRouteGate,
  resolveRouteGate,
  resolveRouteTransfer,
} from '@/mock/processConfigSeed'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { getDeviceById } from '@/store/equipmentStore'
import { getActiveCategoryNames } from '@/store/processCategoryStore'
import { normalizeReportMode } from '@/utils/reportMode'
import { normalizeTaskExecutionMode } from '@/utils/taskExecutionMode'
import {
  defaultQcConfigsFromOperations,
  deriveProcessGateFromAssaySchemes,
  normalizeProcessQcConfigs,
} from '@/utils/qcProcessConfig'
import { persistJson, safeSetItem } from '@/utils/safeStorage'
import { normalizeProcessWorkItemFields } from '@/utils/processWorkItem'
import { positionOptions } from '@/store/employeeGroupStore'
import { getUser } from '@/utils/auth'

const STORAGE_KEY = 'i_doms_process_config'
const SEED_VERSION_KEY = 'i_doms_process_config_seed_v'
const CURRENT_SEED_VERSION = '21'

function resolveOperatorName() {
  const user = getUser()
  return user?.name || user?.username || user?.realName || 'admin1'
}

function nowDateText() {
  return dayjs().format('YYYY-MM-DD HH:mm')
}

export {
  PROCESS_OPERATION_DEFS,
  REPORT_MODES,
  TASK_EXECUTION_MODES,
  RESOURCE_TYPES,
  MOCK_POSITIONS,
  PROCESS_RESPONSIBLE_OPTIONS,
  formatProcessResponsible,
  PROCESS_GATE_OPTIONS,
  PROCESS_GATE_RECORD,
  PROCESS_GATE_HARD,
  PROCESS_GATE_INHERIT,
  normalizeProcessGate,
  formatProcessGate,
  isCustomRouteGate,
  resolveRouteGate,
  resolveRouteTransfer,
}

export const PROCESS_STATUS = ['使用中', '已停用']

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed.processes)) return parsed.processes
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
  persistJson(STORAGE_KEY, { processes: processConfigState.processes })
  safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

function normalizeOperations(ops = {}) {
  const base = Object.fromEntries(PROCESS_OPERATION_DEFS.map((d) => [d.key, false]))
  return { ...base, ...ops }
}

function normalizeProcessList(list) {
  return (list || []).map((p) => {
    const operations = normalizeOperations(p.operations)
    let qcConfigs = normalizeProcessQcConfigs(
      Array.isArray(p.qcConfigs) && p.qcConfigs.length
        ? p.qcConfigs
        : defaultQcConfigsFromOperations(operations),
    )
    if (qcConfigs.length) {
      operations.opQc = true
    } else if (!operations.opQc) {
      qcConfigs = []
    }
    const defaultExecutors = resolveDefaultExecutors(p)
    const responsibleName = defaultExecutors[0] || ''
    const rest = { ...p }
    delete rest.equipmentClasses
    const stamp = p.updatedAt || p.createdAt || nowDateText()
    return {
      ...rest,
      instruction: p.instruction || '',
      params: normalizeProcessParams(p.params).params,
      gateMode: qcConfigs.length
        ? deriveProcessGateFromAssaySchemes(qcConfigs)
        : normalizeProcessGate(p.gateMode),
      transferCondition: p.transferCondition || '',
      equipmentIds: Array.isArray(p.equipmentIds) ? [...p.equipmentIds] : [],
      formTemplateId: p.formTemplateId || '',
      // 流程型只挂岗位；历史班组/工人统一收敛为岗位
      responsibleType: 'position',
      responsibleName,
      resourceType: p.resourceType || '岗位',
      position: responsibleName || '',
      isBlanking: p.isBlanking != null ? Boolean(p.isBlanking) : false,
      defaultExecutors,
      reportMode: normalizeReportMode(p.reportMode),
      taskExecutionMode: normalizeTaskExecutionMode(p.taskExecutionMode),
      defectItemIds: Array.isArray(p.defectItemIds) ? [...p.defectItemIds] : [],
      operations,
      qcConfigs,
      creator: p.creator || '系统管理员',
      createdAt: p.createdAt || stamp,
      updater: p.updater || p.creator || '系统管理员',
      updatedAt: p.updatedAt || stamp,
      ...normalizeProcessWorkItemFields(p),
    }
  })
}

export const processConfigState = reactive({
  processes: normalizeProcessList(
    shouldReseed() ? createProcessConfigSeed() : loadFromStorage() || createProcessConfigSeed(),
  ),
})

watch(
  () => processConfigState.processes,
  () => persist(),
  { deep: true },
)

export function generateProcessCode(existingCodes = []) {
  const max = existingCodes.reduce((m, code) => {
    const match = String(code).match(/^GX(\d+)$/i)
    const n = match ? Number(match[1]) : 0
    return Math.max(m, n)
  }, 0)
  return `GX${String(max + 1).padStart(8, '0')}`
}

export function getProcessById(id) {
  return processConfigState.processes.find((p) => p.id === id) || null
}

export function getProcessByCode(code) {
  return processConfigState.processes.find((p) => p.code === code) || null
}

export function getProcessByName(name) {
  return processConfigState.processes.find((p) => p.name === name) || null
}

/** 读取工序默认执行岗位（复制数组，避免引用污染） */
export function resolveDefaultExecutors(process) {
  if (!process) return []
  const list = process.defaultExecutors
  if (Array.isArray(list) && list.length) {
    return [...new Set(list.map((n) => String(n || '').trim()).filter(Boolean))]
  }
  if (process.responsibleName) return [String(process.responsibleName).trim()]
  if (process.position) return [String(process.position).trim()]
  return []
}

function responsibleFields(payload) {
  const fromList = Array.isArray(payload.defaultExecutors)
    ? payload.defaultExecutors.map((n) => String(n || '').trim()).filter(Boolean)
    : []
  if (!fromList.length) {
    const single = String(payload.responsibleName || payload.position || '').trim()
    if (single) fromList.push(single)
  }
  const defaultExecutors = [...new Set(fromList)]
  const responsibleName = defaultExecutors[0] || ''
  return {
    responsibleType: 'position',
    responsibleName,
    resourceType: payload.resourceType || '岗位',
    position: responsibleName,
    defaultExecutors,
  }
}

export function countProcessesByCategory(categoryName) {
  return processConfigState.processes.filter((p) => p.category === categoryName).length
}

export function renameProcessCategory(oldName, newName) {
  processConfigState.processes.forEach((p) => {
    if (p.category === oldName) p.category = newName
  })
}

/** 工艺路线编辑器：使用中分类 + 使用中工序 */
export function getProcessesByCategory(category) {
  const activeCats = getActiveCategoryNames()
  if (!activeCats.includes(category)) return []
  return processConfigState.processes.filter(
    (p) => p.category === category && p.status === '使用中',
  )
}

export function getActiveProcessCategories() {
  const activeCats = getActiveCategoryNames()
  return activeCats.filter((cat) =>
    processConfigState.processes.some((p) => p.category === cat && p.status === '使用中'),
  )
}

function isProcessUsedInRoutes(processId) {
  try {
    const raw = localStorage.getItem('i_doms_process_routes')
    if (!raw) return false
    const routes = JSON.parse(raw).routes || []
    return routes.some((route) =>
      (route.grid || []).some((step) => (step || []).some((cell) => cell?.processId === processId)),
    )
  } catch {
    return false
  }
}

export function filterProcessConfig(list, filters = {}) {
  return list.filter((p) => {
    if (filters.name) {
      const kw = String(filters.name).trim()
      const hitName = String(p.name || '').includes(kw)
      const hitCode = String(p.code || '').includes(kw)
      if (!hitName && !hitCode) return false
    }
    if (filters.code && !String(p.code || '').includes(filters.code)) return false
    if (filters.category && p.category !== filters.category) return false
    if (filters.resourceType && p.resourceType !== filters.resourceType) return false
    if (filters.status && p.status !== filters.status) return false
    return true
  })
}

export function formatProcessEquipment(process) {
  const ids = process?.equipmentIds
  if (!Array.isArray(ids) || !ids.length) return ''
  return ids
    .map((id) => {
      const device = getDeviceById(id)
      if (!device) return ''
      return device.code ? `${device.name}（${device.code}）` : device.name
    })
    .filter(Boolean)
    .join('、')
}

function validateEquipmentIds(ids) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : []
  const missing = list.find((id) => {
    const device = getDeviceById(id)
    return !device || device.status === EQUIPMENT_STATUS.SCRAPPED
  })
  if (missing) return { ok: false, message: '关联设备须从设备台账中选择' }
  return { ok: true, ids: list }
}

export function normalizeProcessParams(params) {
  const rows = []
  for (const param of Array.isArray(params) ? params : []) {
    const name = String(param?.name || '').trim()
    if (!name) continue
    const numberOrNull = (value) =>
      value === '' || value == null || Number.isNaN(Number(value)) ? null : Number(value)
    const next = {
      name,
      unit: String(param?.unit || '').trim(),
      target: numberOrNull(param?.target),
      min: numberOrNull(param?.min),
      max: numberOrNull(param?.max),
    }
    if (next.min != null && next.max != null && next.min > next.max) {
      return { ok: false, message: `${name} 的下限不能大于上限`, params: [] }
    }
    rows.push(next)
  }
  return { ok: true, params: rows }
}

export function formatProcessParams(process) {
  const names = (process?.params || []).map((param) => param.name).filter(Boolean)
  return names.length ? names.join('、') : ''
}

function validateProcessForm(payload, editingId) {
  if (!payload.name?.trim()) return { ok: false, message: '请输入工序名称' }
  if (!payload.category) return { ok: false, message: '请选择工序分类' }
  if (payload.gateMode !== PROCESS_GATE_RECORD && payload.gateMode !== PROCESS_GATE_HARD) {
    return { ok: false, message: '请选择门禁' }
  }
  const equipmentCheck = validateEquipmentIds(payload.equipmentIds)
  if (!equipmentCheck.ok) return equipmentCheck
  const party = responsibleFields(payload)
  if (!party.defaultExecutors.length) {
    return { ok: false, message: '请选择默认执行' }
  }
  const allowed = new Set([
    ...(positionOptions || []),
    ...(MOCK_POSITIONS || []),
    ...PROCESS_RESPONSIBLE_OPTIONS.filter((item) => item.type === 'position').map(
      (item) => item.name,
    ),
  ])
  const unknown = party.defaultExecutors.find((name) => !allowed.has(name))
  if (unknown) return { ok: false, message: `默认执行「${unknown}」不在岗位主数据中` }

  const code = payload.code?.trim()
  if (code) {
    const dup = processConfigState.processes.find((p) => p.code === code && p.id !== editingId)
    if (dup) return { ok: false, message: '工序编码已存在' }
  }

  const activeCats = getActiveCategoryNames()
  if (!activeCats.includes(payload.category)) {
    return { ok: false, message: '所选工序分类不可用' }
  }
  const paramCheck = normalizeProcessParams(payload.params)
  if (!paramCheck.ok) return paramCheck

  return { ok: true, params: paramCheck.params }
}

export function addProcessConfig(payload) {
  const check = validateProcessForm(payload)
  if (!check.ok) return check

  const codes = processConfigState.processes.map((p) => p.code)
  const operations = normalizeOperations(payload.operations)
  const qcConfigs = normalizeProcessQcConfigs(
    payload.qcConfigs ?? defaultQcConfigsFromOperations(operations),
  )
  if (qcConfigs.length) operations.opQc = true
  else operations.opQc = false

  const gateMode = deriveProcessGateFromAssaySchemes(qcConfigs)

  const workItemFields = normalizeProcessWorkItemFields(payload)

  const party = responsibleFields(payload)
  const row = {
    id: `proc-${Date.now()}`,
    code: payload.code?.trim() || generateProcessCode(codes),
    name: payload.name.trim(),
    category: payload.category,
    instruction: payload.instruction?.trim() || '',
    gateMode,
    transferCondition: payload.transferCondition?.trim() || '',
    equipmentIds: validateEquipmentIds(payload.equipmentIds).ids,
    formTemplateId: payload.formTemplateId || '',
    params: check.params,
    ...party,
    image: payload.image || '',
    remark: payload.remark?.trim() || '',
    status: '使用中',
    operations,
    isBlanking: false,
    reportMode: payload.reportMode ? normalizeReportMode(payload.reportMode) : '',
    taskExecutionMode: normalizeTaskExecutionMode(payload.taskExecutionMode),
    defectItemIds: Array.isArray(payload.defectItemIds) ? [...payload.defectItemIds] : [],
    qcConfigs: operations.opQc ? qcConfigs : [],
    ...workItemFields,
    creator: resolveOperatorName(),
    createdAt: nowDateText(),
    updater: resolveOperatorName(),
    updatedAt: nowDateText(),
  }
  processConfigState.processes.unshift(row)
  return { ok: true, process: row }
}

export function updateProcessConfig(id, payload) {
  const idx = processConfigState.processes.findIndex((p) => p.id === id)
  if (idx === -1) return { ok: false, message: '工序不存在' }

  const check = validateProcessForm(payload, id)
  if (!check.ok) return check

  const row = processConfigState.processes[idx]
  const operations = normalizeOperations(
    payload.operations != null ? payload.operations : row.operations,
  )
  const qcConfigs = normalizeProcessQcConfigs(
    payload.qcConfigs != null ? payload.qcConfigs : row.qcConfigs || [],
  )
  if (qcConfigs.length) operations.opQc = true
  else operations.opQc = false

  const gateMode = deriveProcessGateFromAssaySchemes(qcConfigs)

  Object.assign(row, {
    code: payload.code?.trim() || row.code,
    name: payload.name.trim(),
    category: payload.category,
    instruction: payload.instruction?.trim() || '',
    gateMode,
    transferCondition: payload.transferCondition?.trim() || '',
    equipmentIds: validateEquipmentIds(payload.equipmentIds).ids,
    formTemplateId:
      payload.formTemplateId !== undefined
        ? payload.formTemplateId || ''
        : row.formTemplateId || '',
    params: check.params,
    ...responsibleFields(payload),
    image: payload.image ?? row.image,
    remark: payload.remark?.trim() ?? row.remark,
    operations,
    isBlanking: false,
    reportMode: payload.reportMode
      ? normalizeReportMode(payload.reportMode)
      : normalizeReportMode(row.reportMode),
    taskExecutionMode: normalizeTaskExecutionMode(
      payload.taskExecutionMode ?? row.taskExecutionMode,
    ),
    defectItemIds: Array.isArray(payload.defectItemIds) ? [...payload.defectItemIds] : [],
    qcConfigs: operations.opQc ? qcConfigs : [],
    ...normalizeProcessWorkItemFields(payload),
    creator: row.creator || resolveOperatorName(),
    createdAt: row.createdAt || nowDateText(),
    updater: resolveOperatorName(),
    updatedAt: nowDateText(),
  })
  return { ok: true, process: row }
}

export function deleteProcessConfig(id) {
  const idx = processConfigState.processes.findIndex((p) => p.id === id)
  if (idx === -1) return { ok: false, message: '工序不存在' }
  if (isProcessUsedInRoutes(id)) {
    return { ok: false, message: '该工序已被工艺路线引用，无法删除' }
  }
  processConfigState.processes.splice(idx, 1)
  return { ok: true }
}

export function getOperationLabels(process) {
  if (!process?.operations) return []
  return PROCESS_OPERATION_DEFS.filter((d) => process.operations[d.key]).map((d) => d.label)
}
