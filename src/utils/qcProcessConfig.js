import { qcTemplateBizScopeOptions } from '@/mock/qcTemplates'
import { qcBizScopeLabel } from '@/constants/qcBizScopeLabel'
import {
  PROCESS_GATE_HARD,
  PROCESS_GATE_RECORD,
  normalizeProcessGate,
} from '@/mock/processConfigSeed'

const PROCESS_QC_BIZ_SCOPES = ['生产过程检', '成品检']

/**
 * 过程检下的化验类型（贴近现场叫法）
 * - 投料前核对：投料/配料前再核含量、水分等
 * - 中控取样：反应/过程中取样送检，可多次
 * - 转序放行：本步做完要往下走前的必做化验
 */
export const PROCESS_ASSAY_TYPE_OPTIONS = [
  { value: 'feed_check', label: '投料前核对', bizScope: '生产过程检' },
  { value: 'in_process', label: '中控取样', bizScope: '生产过程检' },
  { value: 'release', label: '转序放行', bizScope: '生产过程检' },
]

/** 成品检下的化验类型 */
export const FINISHED_ASSAY_TYPE_OPTIONS = [
  { value: 'finished', label: '产出化验', bizScope: '成品检' },
]

export const ASSAY_TYPE_OPTIONS = [...PROCESS_ASSAY_TYPE_OPTIONS, ...FINISHED_ASSAY_TYPE_OPTIONS]

export const ASSAY_GATE_HINT =
  '门禁说明：记录 · 技术员判定 — 可发起化验，不挡本步确认（适合中控取样）；硬门禁 · 系统自动卡 — 确认本步前该类型最新结果须合格（适合转序放行/产出化验，不合格可再送检）。模板不钉死，按业务类型 + 物料 + 工序自动匹配。'

export function isProcessQcBizScope(bizScope) {
  return PROCESS_QC_BIZ_SCOPES.includes(bizScope)
}

export function assayTypeOptionsForBizScope(bizScope) {
  if (bizScope === '成品检') return FINISHED_ASSAY_TYPE_OPTIONS
  return PROCESS_ASSAY_TYPE_OPTIONS
}

export function assayTypeLabel(assayType, bizScope) {
  const hit = ASSAY_TYPE_OPTIONS.find((item) => item.value === assayType)
  if (hit) return hit.label
  if (bizScope === '成品检') return '产出化验'
  return '中控取样'
}

function resolveAssayType(partial = {}, bizScope) {
  const raw = String(partial.assayType || '').trim()
  const allowed = assayTypeOptionsForBizScope(bizScope).map((item) => item.value)
  if (raw && allowed.includes(raw)) return raw
  // 兼容旧数据：用方案名称反推
  const name = String(partial.name || '').trim()
  if (name.includes('投料') || name.includes('配料') || name.includes('核对')) return 'feed_check'
  if (name.includes('放行') || name.includes('转序')) return 'release'
  if (name.includes('成品') || name.includes('产出')) return 'finished'
  if (name.includes('中控') || name.includes('取样') || name.includes('过程')) return 'in_process'
  return bizScope === '成品检' ? 'finished' : 'in_process'
}

/**
 * 工序可发起的化验方案：业务类型 + 化验类型；模板一律匹配，不钉死
 */
export function createProcessQcConfig(partial = {}) {
  const bizScope = isProcessQcBizScope(partial.bizScope) ? partial.bizScope : '生产过程检'
  const assayType = resolveAssayType(partial, bizScope)
  const name = assayTypeLabel(assayType, bizScope)
  const gateMode = normalizeProcessGate(
    partial.gateMode || (partial.hardGate ? PROCESS_GATE_HARD : PROCESS_GATE_RECORD),
  )
  return {
    id: partial.id || `pqc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    enabled: partial.enabled === false ? false : true,
    name,
    assayType,
    bizScope,
    templateCode: '', // 一律留空，按匹配
    gateMode,
    hardGate: gateMode === PROCESS_GATE_HARD,
    allowMultiple: partial.allowMultiple === false ? false : true,
    remark: partial.remark || '',
  }
}

export function normalizeProcessQcConfigs(list) {
  if (!Array.isArray(list)) return []
  const seenIds = new Set()
  const result = []
  list.forEach((row) => {
    const item = createProcessQcConfig(row)
    if (!item.enabled) return
    if (seenIds.has(item.id)) {
      item.id = `pqc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    }
    seenIds.add(item.id)
    result.push(item)
  })
  return result
}

export function processQcBizScopeOptions() {
  return qcTemplateBizScopeOptions
    .filter((v) => isProcessQcBizScope(v))
    .map((v) => ({ label: qcBizScopeLabel(v), value: v }))
}

/** 从旧工序 opQc 迁移默认配置（种子数据兼容） */
export function defaultQcConfigsFromOperations(operations = {}) {
  if (!operations?.opQc) return []
  return [
    createProcessQcConfig({
      id: 'pqc-default-process',
      bizScope: '生产过程检',
      assayType: 'in_process',
      gateMode: PROCESS_GATE_RECORD,
      allowMultiple: true,
    }),
  ]
}

export function hasHardGateAssayScheme(qcConfigs = []) {
  return normalizeProcessQcConfigs(qcConfigs).some(
    (row) => row.gateMode === PROCESS_GATE_HARD || row.hardGate,
  )
}

/** 工序级门禁：任一方案为硬门禁则为硬 */
export function deriveProcessGateFromAssaySchemes(qcConfigs = []) {
  return hasHardGateAssayScheme(qcConfigs) ? PROCESS_GATE_HARD : PROCESS_GATE_RECORD
}

export function resolveAssaySchemesForStep(step, process) {
  // 有数组（含空）表示步骤已落过快照；未维护时才回落工序默认
  if (Array.isArray(step?.assaySchemes)) return normalizeProcessQcConfigs(step.assaySchemes)
  return normalizeProcessQcConfigs(process?.qcConfigs || [])
}

export function isAssaySchemeHardGate(scheme) {
  if (!scheme) return false
  return normalizeProcessGate(scheme.gateMode) === PROCESS_GATE_HARD || Boolean(scheme.hardGate)
}

/** 过程检方案（投料前核对 / 中控 / 转序），在工序「化验」清单发起 */
export function isProcessAssayScheme(scheme) {
  return (scheme?.bizScope || '生产过程检') === '生产过程检'
}

/** 成品检 / 产出化验：挂在产出行，记产出时发起，不在工序化验弹窗单选 */
export function isFinishedAssayScheme(scheme) {
  return scheme?.bizScope === '成品检'
}

function isInProcessAssayScheme(scheme) {
  if (!scheme) return false
  const type = resolveAssayType(scheme, scheme.bizScope || '生产过程检')
  return type === 'in_process'
}

function formatInProcessAssayResultDetail(task) {
  if (!task) return ''
  const result = String(task.qcResult || '').trim() || '已完成'
  const measured = []
  for (const line of task.lineItems || []) {
    for (const fv of line.fieldValues || []) {
      const name = String(fv.name || fv.fieldName || '').trim()
      const code = String(fv.code || fv.fieldCode || '').trim()
      const val = fv.value ?? fv.fieldValue
      if (val == null || val === '') continue
      if (/结论|判定|CONCLUSION/i.test(name) || /CONCLUSION|RESULT/i.test(code)) continue
      const unit = String(fv.unit || '').trim()
      measured.push(name ? `${name} ${val}${unit}` : `${val}${unit}`)
    }
  }
  const extra = measured.slice(0, 3).join('，')
  return extra ? `${result}（${extra}）` : result
}

/**
 * 打开当前步时的「上一步中控取样」提示（经验增强，不挡操作、不是新门禁）
 * @returns {{ text: string, status: 'pending'|'done', taskId?: string, prevStepNo?: number, prevStepName?: string } | null}
 */
export function buildPriorInProcessAssayHint({
  order,
  currentStepNo,
  getQcTaskById,
  getStepQcRecords,
} = {}) {
  if (
    !order ||
    !(Number(currentStepNo) > 0) ||
    typeof getQcTaskById !== 'function' ||
    typeof getStepQcRecords !== 'function'
  ) {
    return null
  }
  const steps = [...(order.routeSnapshot || [])].sort((a, b) => Number(a.stepNo) - Number(b.stepNo))
  const curIdx = steps.findIndex((s) => Number(s.stepNo) === Number(currentStepNo))
  if (curIdx <= 0) return null
  const prev = steps[curIdx - 1]
  if (!prev) return null

  const schemes = resolveAssaySchemesForStep(prev, null).filter(isInProcessAssayScheme)
  const schemeIds = new Set(schemes.map((s) => s.id).filter(Boolean))

  const records = (getStepQcRecords(order, prev.stepNo) || []).filter((row) => {
    if (row.assayType === 'in_process') return true
    if (schemeIds.size && row.schemeId && schemeIds.has(row.schemeId)) return true
    const name = String(row.schemeName || '')
    return /中控|取样/.test(name)
  })

  // 未配置中控方案且无相关检单 → 不提示
  if (!schemes.length && !records.length) return null
  // 已配置但尚未发起 → 仍可提示未取样，便于现场知晓
  if (!records.length) {
    return {
      text: `上一步（${prev.name || `步骤${prev.stepNo}`}）中控取样：未发起`,
      status: 'pending',
      prevStepNo: prev.stepNo,
      prevStepName: prev.name || '',
    }
  }

  const latest = records[records.length - 1]
  const task = latest.taskId ? getQcTaskById(latest.taskId) : null
  const qcStatus = task?.qcStatus || latest.qcStatus || ''
  const done = qcStatus === '已完成'
  if (!done) {
    return {
      text: `上一步（${prev.name || `步骤${prev.stepNo}`}）中控取样：进行中`,
      status: 'pending',
      taskId: latest.taskId || task?.id || '',
      prevStepNo: prev.stepNo,
      prevStepName: prev.name || '',
    }
  }
  const detail = formatInProcessAssayResultDetail(task) || latest.qcResult || '已完成'
  return {
    text: `上一步（${prev.name || `步骤${prev.stepNo}`}）中控取样：已出结果：${detail}`,
    status: 'done',
    taskId: latest.taskId || task?.id || '',
    prevStepNo: prev.stepNo,
    prevStepName: prev.name || '',
  }
}
