import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import {
  calcTheoreticalFeed,
  planBatchCount,
  round3,
  theoreticalOutput,
  yieldGap,
} from '@/utils/processBatchMath'
import {
  getFormula,
  itemLabel,
  itemMasterCard,
  itemUnit,
  stepParamRows,
  OUTPUT_ROLE_LABEL,
  OUTPUT_DISPOSITION_LABEL,
  batchStatusForDisposition,
  createsOutputBatchDisposition,
  isStockOutputDisposition,
  locationKindForDisposition,
  normalizeOutputAssayScopes,
  normalizeOutputDisposition,
} from '@/store/processFormulaStore'
import { getProcessById } from '@/store/processConfigStore'
import { normalizeProcessGate, PROCESS_GATE_HARD } from '@/mock/processConfigSeed'
import { getProcessRouteById } from '@/store/processRouteStore'
import { deviceLabelById } from '@/store/equipmentStore'
import { QC_TASK_RESULT } from '@/constants/qcTaskResult'
import { flattenGridToSteps } from '@/utils/processRouteGrid'
import {
  snapshotFormTemplateForProcess,
  resolveStepFormTemplate,
} from '@/utils/processFormTemplateSnapshot'
import {
  deriveProcessGateFromAssaySchemes,
  isAssaySchemeHardGate,
  resolveAssaySchemesForStep,
} from '@/utils/qcProcessConfig'
import {
  isProcessFormSystemField,
  resolveProcessFormSystemValue,
} from '@/utils/processFormSystemField'
import {
  filterTemplateFieldsBeyondFixed,
  stepConfirmFixedFieldDefs,
} from '@/utils/stepConfirmFixedFields'
import {
  addOutputBatch,
  consumeBatchQty,
  getMaterialBatch,
  listProcessItems,
  listTanks,
  planFeedFifoAllocations,
  setBatchStatus,
} from '@/store/materialBatchStore'
import { addInboundOrder } from '@/store/inboundOrderStore'
import { createInboundLine } from '@/mock/inboundOrders'
import { appendOperationLog, currentOperator } from '@/utils/operationLog'
import { getDeviceById, updateDevice } from '@/store/equipmentStore'
import { getProductionLineById } from '@/store/productionLineStore'
import { positionOptions } from '@/store/employeeGroupStore'
import { EQUIPMENT_OCCUPY_STATUS, EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { generateCodeByBusiness, peekCodesByBusiness } from '@/store/codingRuleStore'

const STORAGE_KEY = 'i-doms-batch-instruction-v1'

export const ORDER_STATUS_LABEL = {
  pending_release: '待下发',
  running: '执行中',
  done: '完成',
  cancelled: '已作废',
}

function hydrateFeedSteps(orders) {
  return (orders || []).map((order) => {
    const formula = getFormula(order.formulaId)
    const outputQcRecords = (order.outputQcRecords || []).filter((row) => {
      const scope = String(row?.bizScope || '成品检').trim() || '成品检'
      return scope === '成品检'
    })
    return {
      ...order,
      formActuals: Array.isArray(order.formActuals) ? order.formActuals : [],
      ebrEntries: Array.isArray(order.ebrEntries) ? order.ebrEntries : [],
      stepQcMap: order.stepQcMap && typeof order.stepQcMap === 'object' ? order.stepQcMap : {},
      outputQcRecords,
      theoreticalFeeds: (order.theoreticalFeeds || []).map((line) => {
        if (Number(line.stepNo) > 0) return line
        const source = (formula?.lines || []).find((item) => item.itemId === line.itemId)
        const step = (formula?.steps || []).find((item) => item.stepNo === Number(source?.stepNo))
        if (!step) return { ...line, stepNo: null, stepName: line.stepName || '' }
        return { ...line, stepNo: step.stepNo, stepName: step.name || '' }
      }),
      expectedOutputs: (order.expectedOutputs || []).map((line) => {
        if (Number(line.stepNo) > 0) {
          return {
            ...line,
            stepName:
              line.stepName ||
              (formula?.steps || []).find((s) => Number(s.stepNo) === Number(line.stepNo))?.name ||
              '',
          }
        }
        const source = (formula?.outputs || []).find(
          (item) => item.itemId === line.itemId && item.role === line.role,
        )
        let stepNo = Number(source?.stepNo)
        if (!(stepNo > 0) && formula?.steps?.length) {
          stepNo = Number(formula.steps[formula.steps.length - 1].stepNo) || formula.steps.length
        }
        const step = (formula?.steps || []).find((item) => Number(item.stepNo) === stepNo)
        return {
          ...line,
          stepNo: stepNo > 0 ? stepNo : null,
          stepName: source?.stepName || step?.name || '',
        }
      }),
    }
  })
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return hydrateFeedSteps(parsed)
  } catch {
    return null
  }
}

export const batchInstructionState = reactive({
  orders: load() || [],
})

watch(
  () => batchInstructionState.orders,
  () => localStorage.setItem(STORAGE_KEY, JSON.stringify(batchInstructionState.orders)),
  { deep: true },
)

/** 演示批次：对应已生效配方，下发后可在保温步发起中控取样、在灌装步发起产出化验。 */
const DEMO_BATCH_ORDERS = [
  {
    id: 'bo-demo-paint',
    batchNo: 'BO-DEMO-PAINT',
    formulaId: 'formula-paint',
    sourceLabel: '演示：醇酸面漆',
  },
  {
    id: 'bo-demo-alkyd',
    batchNo: 'BO-DEMO-ALKYD',
    formulaId: 'formula-alkyd',
    sourceLabel: '演示：醇酸树脂液',
  },
  {
    id: 'bo-demo-custom',
    batchNo: 'BO-DEMO-CUS',
    formulaId: 'formula-custom',
    sourceLabel: '演示：客户指定色漆',
  },
]

function buildDemoBatchOrder(demo) {
  const formula = getFormula(demo.formulaId)
  if (!formula || formula.status !== 'active') return null
  const order = {
    id: demo.id,
    batchNo: demo.batchNo,
    status: 'running',
    seq: 1,
    batchCount: 1,
    qty: formula.baseBatchQty,
    qtyConfirmed: true,
    unit: 'kg',
    formulaId: formula.id,
    formulaVersion: formula.version,
    formulaName: formula.name,
    itemId: formula.itemId,
    theoreticalOutput: theoreticalOutput(formula.baseBatchQty, formula.theoreticalYield),
    theoreticalFeeds: snapshotFeeds(formula),
    expectedOutputs: snapshotOutputs(formula),
    routeSnapshot: snapshotSteps(formula.steps),
    equipmentRoute: snapshotEquipmentRoute(formula),
    feeds: [],
    paramActuals: [],
    formActuals: [],
    ebrEntries: [],
    stepQcMap: {},
    confirmedSteps: [],
    outputs: [],
    actualOutput: null,
    yieldGap: null,
    deviation: '',
    remark: '演示批次，可直接发起中控取样和产出化验',
    reworkOfBatchId: '',
    feedPlanId: '',
    productionLineId: '',
    executeBy: 'formula',
    sourceLabel: demo.sourceLabel,
    demandQty: formula.baseBatchQty,
    createdAt: '2026-11-18 09:30',
    createdBy: '系统管理员',
  }
  appendOperationLog(order, '生成批次指令', demo.sourceLabel, '系统管理员')
  appendOperationLog(order, '下发', '演示链路', '系统管理员')
  return order
}

function ensureDemoBatchOrders() {
  DEMO_BATCH_ORDERS.forEach((demo) => {
    if (
      batchInstructionState.orders.some((row) => row.id === demo.id || row.batchNo === demo.batchNo)
    ) {
      return
    }
    const order = buildDemoBatchOrder(demo)
    if (order) batchInstructionState.orders.push(order)
  })
}

ensureDemoBatchOrders()

let seq = 1

/** 系统默认批次号：BO + 日期 + 流水。 */
function nextSystemBatchNo() {
  seq += 1
  return `BO${dayjs().format('YYYYMMDD')}${String(seq).padStart(3, '0')}`
}

/**
 * 批次号：优先用户自定义；否则走「生产管理-批次指令」编码规则；再没有规则则用系统默认。
 */
export function nextBatchNo(custom) {
  const manual = String(custom || '').trim()
  if (manual) {
    assertBatchNoAvailable(manual)
    return manual
  }
  for (let i = 0; i < 20; i += 1) {
    const coded = generateCodeByBusiness('batch_instruction')
    if (!coded) break
    if (!batchInstructionState.orders.some((row) => row.batchNo === coded)) return coded
  }
  let candidate = nextSystemBatchNo()
  while (batchInstructionState.orders.some((row) => row.batchNo === candidate)) {
    candidate = nextSystemBatchNo()
  }
  return candidate
}

/**
 * 预览后续 N 个批次号（按编码规则；无规则则按系统 BO+日期+流水），不占用正式流水。
 * @param {number} count
 * @param {{ exclude?: string[] }} [options]
 */
export function previewNextBatchNos(count, options = {}) {
  const n = Math.max(0, Math.min(200, Number(count) || 0))
  if (!n) return []
  const taken = new Set([
    ...(batchInstructionState.orders || []).map((row) => row.batchNo),
    ...(options.exclude || []).map((v) => String(v || '').trim()).filter(Boolean),
  ])
  const result = []
  const peeked = peekCodesByBusiness('batch_instruction', n + 40)
  for (const code of peeked) {
    if (result.length >= n) break
    if (!code || taken.has(code)) continue
    result.push(code)
    taken.add(code)
  }
  let localSeq = seq
  while (result.length < n) {
    localSeq += 1
    const candidate = `BO${dayjs().format('YYYYMMDD')}${String(localSeq).padStart(3, '0')}`
    if (taken.has(candidate)) continue
    result.push(candidate)
    taken.add(candidate)
  }
  return result
}

function assertBatchNoAvailable(batchNo) {
  if (batchInstructionState.orders.some((row) => row.batchNo === batchNo)) {
    throw new Error(`批次号「${batchNo}」已存在`)
  }
}

function snapshotFeeds(formula) {
  const steps = formula.steps || []
  return (formula.lines || []).map((line) => {
    const calc = calcTheoreticalFeed({ ...line, content: line.content }, formula.baseBatchQty)
    const step = steps.find((item) => item.stepNo === Number(line.stepNo))
    return {
      itemId: line.itemId,
      qty: line.theoreticalQty ?? (calc.ok ? calc.qty : 0),
      feedSequence: line.feedSequence,
      stepNo: step ? step.stepNo : null,
      stepName: step?.name || '',
      convertByContent: line.convertByContent,
      tolerance: line.tolerance ?? null,
      isKeyMaterial: Boolean(line.isKeyMaterial),
      isAuxiliary: Boolean(line.isAuxiliary),
    }
  })
}

function snapshotOutputs(formula) {
  const steps = formula.steps || []
  return (formula.outputs || []).map((o) => {
    const stepNo = Number(o.stepNo) > 0 ? Number(o.stepNo) : null
    const step = steps.find((item) => Number(item.stepNo) === stepNo)
    return {
      role: o.role,
      itemId: o.itemId,
      qty: o.expectedQty,
      stepNo,
      stepName: o.stepName || step?.name || '',
      assayScopes: normalizeOutputAssayScopes(o.assayScopes),
    }
  })
}

function snapshotSteps(steps) {
  return (steps || []).map((step) => {
    const proc = step.processId ? getProcessById(step.processId) : null
    // 配方阶段若已改过化验/门禁，用配方快照；否则回落到工序默认
    const assaySchemes = resolveAssaySchemesForStep(step, proc)
    const equipmentIds = Array.isArray(step.equipmentIds)
      ? step.equipmentIds.map((id) => String(id || '').trim()).filter(Boolean)
      : []
    const equipmentId = String(step.equipmentId || equipmentIds[0] || '').trim()
    return {
      ...JSON.parse(JSON.stringify(step)),
      processCode: step.processCode || proc?.code || '',
      processName: step.name || proc?.name || '',
      gateMode: normalizeProcessGate(
        step.gateMode || deriveProcessGateFromAssaySchemes(assaySchemes) || proc?.gateMode,
      ),
      transferCondition: step.transferCondition || proc?.transferCondition || '',
      equipmentIds,
      equipmentId,
      equipmentName: deviceLabelById(equipmentId) || '',
      formTemplate: snapshotFormTemplateForProcess(step.processId),
      assaySchemes,
    }
  })
}

function ensureStepQcBucket(order, stepNo) {
  if (!order.stepQcMap || typeof order.stepQcMap !== 'object') order.stepQcMap = {}
  const key = String(stepNo)
  const prev = order.stepQcMap[key]
  if (!prev || typeof prev !== 'object') {
    order.stepQcMap[key] = { records: [] }
    return order.stepQcMap[key]
  }
  if (!Array.isArray(prev.records)) {
    const legacy = prev.taskId
      ? [
          {
            schemeId: prev.schemeId || '',
            schemeName: prev.schemeName || '',
            bizScope: prev.bizScope || '生产过程检',
            templateCode: prev.templateCode || '',
            taskId: prev.taskId,
            qcNo: prev.qcNo || '',
            qcStatus: prev.qcStatus || '',
            qcResult: prev.qcResult || '',
            inspectedAt: prev.inspectedAt || '',
            updatedAt: prev.updatedAt || '',
          },
        ]
      : []
    order.stepQcMap[key] = { ...prev, records: legacy }
  }
  return order.stepQcMap[key]
}

export function getStepQcLink(order, stepNo) {
  if (!order?.stepQcMap) return null
  const bucket = order.stepQcMap[String(stepNo)] || order.stepQcMap[stepNo]
  if (!bucket) return null
  return bucket
}

export function getStepQcRecords(order, stepNo) {
  const bucket = getStepQcLink(order, stepNo)
  if (!bucket) return []
  if (Array.isArray(bucket.records)) return bucket.records
  if (bucket.taskId) {
    return [
      {
        schemeId: bucket.schemeId || '',
        schemeName: bucket.schemeName || '',
        bizScope: bucket.bizScope || '生产过程检',
        taskId: bucket.taskId,
        qcNo: bucket.qcNo || '',
        qcStatus: bucket.qcStatus || '',
        qcResult: bucket.qcResult || '',
      },
    ]
  }
  return []
}

/** 批次步骤挂上化验单（可同一步多方案、同方案多次） */
export function attachStepQc(orderId, stepNo, task, scheme = {}) {
  const order = getBatchOrder(orderId)
  if (!order) throw new Error('批次指令不存在')
  const bucket = ensureStepQcBucket(order, stepNo)
  const record = {
    schemeId: scheme.id || scheme.schemeId || task?.assaySchemeId || '',
    schemeName: scheme.name || scheme.schemeName || task?.assaySchemeName || '',
    assayType: scheme.assayType || task?.assayType || '',
    bizScope: scheme.bizScope || task?.bizScope || '生产过程检',
    templateCode: scheme.templateCode || task?.templateCode || '',
    hardGate: Boolean(scheme.hardGate),
    taskId: task?.id || '',
    qcNo: task?.qcNo || '',
    qcStatus: task?.qcStatus || '待质检',
    qcResult: task?.qcResult || '',
    inspectedAt: task?.inspectedAt || '',
    processName: task?.processName || '',
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  bucket.records.push(record)
  bucket.taskId = record.taskId
  bucket.qcNo = record.qcNo
  bucket.qcStatus = record.qcStatus
  bucket.qcResult = record.qcResult
  bucket.inspectedAt = record.inspectedAt
  bucket.processName = record.processName
  bucket.schemeId = record.schemeId
  bucket.schemeName = record.schemeName
  bucket.bizScope = record.bizScope
  bucket.updatedAt = record.updatedAt
  appendOperationLog(order, '发起化验', record.schemeName || record.qcNo || '')
  return bucket
}

/** 主产品、副产品的产出化验单挂在批次上，按角色、物料和阶段区分（仅成品检/产出化验）。 */
export function attachOutputInboundQc(orderId, record = {}) {
  const order = getBatchOrder(orderId)
  if (!order) throw new Error('批次指令不存在')
  if (!Array.isArray(order.outputQcRecords)) order.outputQcRecords = []
  const bizScope = String(record.bizScope || '成品检').trim() || '成品检'
  if (bizScope !== '成品检') {
    throw new Error('产出关联化验仅支持产出化验（成品检），过程检请在工序化验清单发起')
  }
  // 清洗历史误写入的过程检记录
  order.outputQcRecords = order.outputQcRecords.filter((row) => {
    const scope = String(row?.bizScope || '成品检').trim() || '成品检'
    return scope === '成品检'
  })
  const row = {
    role: record.role || '',
    itemId: record.itemId || '',
    stepNo: Number(record.stepNo) || null,
    bizScope: '成品检',
    taskId: record.taskId || '',
    qcNo: record.qcNo || '',
    qcStatus: record.qcStatus || '待质检',
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  order.outputQcRecords.push(row)
  appendOperationLog(order, '发起入库化验', row.qcNo || '')
  return row
}

/** 质检提交后回写到批次步骤，并记一条 EBR */
export function syncBatchStepQcFromTask(task) {
  if (!task || task.sourceType !== 'batch_instruction' || !task.sourceDocId) return false
  const order = getBatchOrder(task.sourceDocId)
  if (!order) return false
  const stepNo = Number(task.processIndex)
  if (!(stepNo > 0)) return false
  const bucket = ensureStepQcBucket(order, stepNo)
  const idx = bucket.records.findIndex((row) => row.taskId === task.id)
  const patch = {
    taskId: task.id,
    qcNo: task.qcNo || '',
    qcStatus: task.qcStatus || '',
    qcResult: task.qcResult || '',
    inspector: task.inspector || '',
    inspectedAt: task.inspectedAt || '',
    processName: task.processName || '',
    schemeId: task.assaySchemeId || (idx >= 0 ? bucket.records[idx].schemeId : ''),
    schemeName: task.assaySchemeName || (idx >= 0 ? bucket.records[idx].schemeName : ''),
    bizScope: task.bizScope || (idx >= 0 ? bucket.records[idx].bizScope : '生产过程检'),
    templateCode: task.templateCode || (idx >= 0 ? bucket.records[idx].templateCode : ''),
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  if (idx >= 0) bucket.records[idx] = { ...bucket.records[idx], ...patch }
  else bucket.records.push(patch)
  bucket.taskId = patch.taskId
  bucket.qcNo = patch.qcNo
  bucket.qcStatus = patch.qcStatus
  bucket.qcResult = patch.qcResult
  bucket.inspectedAt = patch.inspectedAt
  bucket.processName = patch.processName
  bucket.schemeId = patch.schemeId
  bucket.schemeName = patch.schemeName
  bucket.bizScope = patch.bizScope
  bucket.updatedAt = patch.updatedAt

  const stepName =
    (order.routeSnapshot || []).find((s) => Number(s.stepNo) === stepNo)?.name ||
    task.processName ||
    ''
  const label = patch.schemeName || task.bizScope || '化验'
  order.ebrEntries = (order.ebrEntries || []).filter(
    (row) => !(Number(row.stepNo) === stepNo && row.source === 'qc' && row.taskId === task.id),
  )
  order.ebrEntries.push({
    stepNo,
    stepName,
    source: 'qc',
    taskId: task.id,
    templateId: task.templateId || '',
    templateName: task.templateName || '',
    equipmentText: '',
    params: [],
    fields: [
      { code: 'QC_SCHEME', name: '化验方案', value: label, valueSource: 'system' },
      { code: 'QC_NO', name: '检单号', value: task.qcNo || '—', valueSource: 'system' },
      {
        code: 'QC_RESULT',
        name: '化验结果',
        value: task.qcResult || task.qcStatus || '—',
        valueSource: 'system',
      },
    ],
    operator: task.inspector || '',
    at: task.inspectedAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
  })
  appendOperationLog(
    order,
    '检验回写',
    `${label} ${task.qcResult || task.qcStatus || ''}`.trim(),
    task.inspector || undefined,
  )
  // 过程检完成后：尝试把含量回填到本步「含量待化验」的投料行
  if (String(task.bizScope || '') === '生产过程检' && task.qcStatus === '已完成') {
    const frac = extractContentFractionFromQcTask(task)
    if (frac != null) {
      const code = String(task.itemCode || '').trim()
      const byCode = code
        ? listProcessItems().find((item) => String(item.code || '') === code)
        : null
      const itemId =
        byCode?.id ||
        (order.feeds || []).find((feed) => Number(feed.stepNo) === stepNo && feed.contentPending)
          ?.itemId ||
        ''
      backfillFeedContentFromAssay(order.id, { stepNo, itemId, content: frac })
    }
  }
  return true
}

function resolveStepGateMode(step) {
  if (step?.gateMode) return normalizeProcessGate(step.gateMode)
  const proc = step?.processId ? getProcessById(step.processId) : null
  return normalizeProcessGate(proc?.gateMode)
}

function latestRecordForScheme(records, scheme) {
  const list = (records || []).filter(
    (row) =>
      (scheme.id && row.schemeId === scheme.id) ||
      (!scheme.id &&
        row.bizScope === scheme.bizScope &&
        String(row.templateCode || '') === String(scheme.templateCode || '')),
  )
  return list.length ? list[list.length - 1] : null
}

function assertHardGateAllowsConfirm(order, step) {
  const gate = resolveStepGateMode(step)
  if (gate !== PROCESS_GATE_HARD) return
  const proc = step?.processId ? getProcessById(step.processId) : null
  // 确认本步只卡「过程检」硬门禁；成品检/产出化验挂在「产出」过账，不在此拦截
  const schemes = resolveAssaySchemesForStep(step, proc).filter(
    (s) => (s.bizScope || '生产过程检') === '生产过程检',
  )
  const hardSchemes = schemes.filter((s) => isAssaySchemeHardGate(s))
  if (!hardSchemes.length && !schemes.length) return
  const records = getStepQcRecords(order, step.stepNo)
  const getTask = (id) => {
    try {
      return require('@/store/qcTaskStore').getQcTaskById(id)
    } catch {
      return null
    }
  }

  const targets = hardSchemes.length
    ? hardSchemes
    : schemes.length
      ? schemes
      : [{ id: '', name: '化验', bizScope: '生产过程检', templateCode: '' }]

  targets.forEach((scheme) => {
    const link =
      latestRecordForScheme(records, scheme) ||
      (hardSchemes.length ? null : records[records.length - 1])
    if (!link?.taskId) {
      throw new Error(
        `${step.name || '本步'} 为硬门禁，请先完成化验「${scheme.name || scheme.bizScope}」`,
      )
    }
    const task = getTask(link.taskId)
    const status = task?.qcStatus || link.qcStatus
    const result = task?.qcResult || link.qcResult
    if (status !== '已完成' || result !== QC_TASK_RESULT.PASS) {
      throw new Error(
        `${step.name || '本步'} 硬门禁「${scheme.name || scheme.bizScope}」未通过（当前：${
          result || status || '未完成'
        }）`,
      )
    }
  })
}

function snapshotEquipmentRoute(formula) {
  const route = formula?.routeId ? getProcessRouteById(formula.routeId) : null
  if (!route) return { routeId: '', routeCode: '', routeName: '', units: [] }
  const flat = flattenGridToSteps(route.grid || [], route.stepPolicies)
  return {
    routeId: route.id,
    routeCode: route.code || '',
    routeName: route.name || '',
    routeMode: route.routeMode || '',
    units: (route.units || []).map((unit) => ({
      equipmentId: unit.equipmentId,
      equipmentName: deviceLabelById(unit.equipmentId) || '',
    })),
    steps: flat.map((step) => ({
      stepNo: step.stepNo,
      rowNo: step.rowNo,
      name: step.name || '',
      equipmentId: step.equipmentId || '',
      equipmentName: deviceLabelById(step.equipmentId) || '',
      returnText: step.returnText || '',
    })),
  }
}

export function listBatchOrders() {
  return batchInstructionState.orders
}

export function getBatchOrder(id) {
  return batchInstructionState.orders.find((o) => o.id === id) || null
}

export function createOrdersFromDemand({
  formulaId,
  demandQty,
  sourceLabel,
  batchNos,
  productionLineId,
  remark,
} = {}) {
  const formula = getFormula(formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择一张生效配方')
  const count = planBatchCount(demandQty, formula.baseBatchQty)
  if (!count) throw new Error('需求量和基准批量都必须大于 0')
  const lineId = productionLineId || ''
  const remarkText = String(remark || '').trim()
  const created = []
  for (let i = 1; i <= count; i += 1) {
    const batchNo = nextBatchNo(Array.isArray(batchNos) ? batchNos[i - 1] : '')
    const order = {
      id: `bo-${Date.now()}-${i}`,
      batchNo,
      status: 'pending_release',
      seq: i,
      batchCount: count,
      qty: formula.baseBatchQty,
      qtyConfirmed: true,
      unit: 'kg',
      formulaId: formula.id,
      formulaVersion: formula.version,
      formulaName: formula.name,
      itemId: formula.itemId,
      theoreticalOutput: theoreticalOutput(formula.baseBatchQty, formula.theoreticalYield),
      theoreticalFeeds: snapshotFeeds(formula),
      expectedOutputs: snapshotOutputs(formula),
      routeSnapshot: snapshotSteps(formula.steps),
      equipmentRoute: snapshotEquipmentRoute(formula),
      feeds: [],
      paramActuals: [],
      formActuals: [],
      ebrEntries: [],
      stepQcMap: {},
      confirmedSteps: [],
      outputs: [],
      actualOutput: null,
      yieldGap: null,
      deviation: '',
      remark: remarkText,
      reworkOfBatchId: '',
      feedPlanId: '',
      productionLineId: lineId,
      executeBy: lineId ? 'line' : 'formula',
      sourceLabel: sourceLabel || '',
      demandQty: Number(demandQty),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      createdBy: currentOperator(),
    }
    appendOperationLog(order, '生成批次指令', sourceLabel || '')
    created.push(order)
  }
  batchInstructionState.orders.splice(0, 0, ...created)
  return created
}

function scaleFeedSnapshots(formula, plannedQty) {
  const base = Number(formula.baseBatchQty)
  const scale = base > 0 ? Number(plannedQty) / base : 1
  return {
    theoreticalFeeds: snapshotFeeds(formula).map((line) => ({
      ...line,
      qty: round3(Number(line.qty) * scale),
      pendingConfirm: false,
    })),
    expectedOutputs: snapshotOutputs(formula).map((row) => ({
      ...row,
      qty: row.qty == null || row.qty === '' ? null : round3(Number(row.qty) * scale),
    })),
    theoreticalOutput: theoreticalOutput(plannedQty, formula.theoreticalYield),
  }
}

/** 从计划生成一张批次指令。计划投料量按该数量展开理论投料和理论产出。 */
export function createTankChargeFromPlan({
  formulaId,
  feedPlanId,
  productionLineId,
  sourceLabel,
  planStart,
  planEnd,
  plannedQty,
  seq = 1,
  batchCount = 1,
  createdBy,
  batchNo: customBatchNo,
  remark,
}) {
  const formula = getFormula(formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择一张生效配方')
  const qty = round3(plannedQty)
  if (!(qty > 0)) throw new Error('计划投料量须大于 0')
  const scaled = scaleFeedSnapshots(formula, qty)
  const batchNo = nextBatchNo(customBatchNo)
  const who = createdBy || currentOperator()
  const order = {
    id: `bo-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 7)}`,
    batchNo,
    status: 'pending_release',
    seq,
    batchCount,
    qty,
    qtyConfirmed: true,
    unit: 'kg',
    formulaId: formula.id,
    formulaVersion: formula.version,
    formulaName: formula.name,
    itemId: formula.itemId,
    theoreticalOutput: scaled.theoreticalOutput,
    theoreticalFeeds: scaled.theoreticalFeeds,
    expectedOutputs: scaled.expectedOutputs,
    routeSnapshot: snapshotSteps(formula.steps),
    equipmentRoute: snapshotEquipmentRoute(formula),
    feeds: [],
    paramActuals: [],
    formActuals: [],
    ebrEntries: [],
    stepQcMap: {},
    confirmedSteps: [],
    outputs: [],
    actualOutput: null,
    yieldGap: null,
    deviation: '',
    remark: String(remark || '').trim(),
    reworkOfBatchId: '',
    feedPlanId: feedPlanId || '',
    productionLineId: productionLineId || '',
    executeBy: productionLineId ? 'line' : 'formula',
    planStart: planStart || '',
    planEnd: planEnd || '',
    sourceLabel: sourceLabel || '',
    demandQty: qty,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    createdBy: who,
  }
  appendOperationLog(order, '生成批次指令', sourceLabel || '', who)
  batchInstructionState.orders.unshift(order)
  return order
}

export function releaseOrder(id) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status !== 'pending_release') throw new Error('只有待下发指令可以下发')
  order.status = 'running'
  appendOperationLog(order, '下发')
  return order
}

/** 数量还没确认的指令按槽次处理，指定下发时必须占用本产线上的一台反应设备。 */
export function isTankChargeOrder(order) {
  if (!order) return false
  return order.qtyConfirmed === false || order.qty == null || order.qty === ''
}

function sameMeasureUnit(left, right) {
  return (
    String(left || '')
      .trim()
      .toLowerCase() ===
    String(right || '')
      .trim()
      .toLowerCase()
  )
}

function reactorHeldBy(tankId, exceptOrderId) {
  return (
    batchInstructionState.orders.find(
      (row) => row.id !== exceptOrderId && row.status === 'running' && row.reactorTankId === tankId,
    ) || null
  )
}

function releaseReactorHold(order) {
  const tankId = order?.reactorTankId
  if (!tankId) return
  const device = getDeviceById(tankId)
  if (!device) return
  if (device.occupiedBatchNo && device.occupiedBatchNo !== order.batchNo) return
  updateDevice(tankId, {
    occupyStatus: EQUIPMENT_OCCUPY_STATUS.CLEAN,
    occupiedBatchNo: '',
  })
}

/** 指定下发前看这台反应设备能不能占。ok 为 false 时不能下发。 */
export function inspectReactorForRelease(order, tankId) {
  if (!tankId) {
    if (isTankChargeOrder(order)) {
      return { ok: false, level: 'error', message: '槽次请选择本产线上的反应设备' }
    }
    return { ok: true, level: 'info', message: '' }
  }
  const device = getDeviceById(tankId)
  if (!device || device.category !== '反应设备') {
    return { ok: false, level: 'error', message: '请选择类别为反应设备的设备' }
  }
  if (device.status === EQUIPMENT_STATUS.REPAIRING || device.status === EQUIPMENT_STATUS.SCRAPPED) {
    return { ok: false, level: 'error', message: `${device.name} 当前${device.status}，不能占用` }
  }
  const holder = reactorHeldBy(tankId, order?.id)
  if (holder) {
    return {
      ok: false,
      level: 'error',
      message: `${device.name} 已被执行中批次 ${holder.batchNo} 占用。该批次完成或作废后才能再占用，某一道工序点确认不会释放这台设备。`,
    }
  }
  const occupy = device.occupyStatus || EQUIPMENT_OCCUPY_STATUS.CLEAN
  const markedBusy =
    occupy === EQUIPMENT_OCCUPY_STATUS.OCCUPIED || occupy === EQUIPMENT_OCCUPY_STATUS.WAIT_DISCHARGE
  if (markedBusy && device.occupiedBatchNo && device.occupiedBatchNo !== order?.batchNo) {
    const named = batchInstructionState.orders.find((row) => row.batchNo === device.occupiedBatchNo)
    if (named && named.status === 'running' && named.id !== order?.id) {
      return {
        ok: false,
        level: 'error',
        message: `${device.name} 已被执行中批次 ${named.batchNo} 占用。该批次完成或作废后才能再占用，某一道工序点确认不会释放这台设备。`,
      }
    }
  }
  const nominal = Number(device.nominalCapacity)
  const working =
    device.workingCapacity == null || device.workingCapacity === ''
      ? null
      : Number(device.workingCapacity)
  const unit = device.capacityUnit || ''
  const summary = `${device.name} · 公称 ${nominal > 0 ? nominal : '—'} ${unit} · 工作 ${
    working > 0 ? working : '—'
  } ${unit} · 占釜 ${occupy}`
  const staleLedger =
    markedBusy &&
    !batchInstructionState.orders.some(
      (row) =>
        row.id !== order?.id &&
        row.status === 'running' &&
        (row.reactorTankId === tankId || row.batchNo === device.occupiedBatchNo),
    )
  const holdNote = staleLedger
    ? `台账占釜是${occupy}，但没有执行中批次占用，可以指定。`
    : '当前没有执行中批次占用。'
  const releaseNote = '设备要等占用它的批次完成或作废后才释放，不是某一道工序点确认就释放。'
  const qty = Number(order?.qty)
  const qtyKnown = !isTankChargeOrder(order) && qty > 0
  if (!qtyKnown) {
    return {
      ok: true,
      level: 'info',
      message: `${summary}。${holdNote}数量未确认，下发后按实投累加，转出或完结时再卡罐容。${releaseNote}`,
    }
  }
  if (!sameMeasureUnit(order.unit, unit)) {
    return {
      ok: true,
      level: 'info',
      message: `${summary}。${holdNote}下达数量 ${qty} ${order.unit || ''}，与容积单位不同，不按数量拦截。${releaseNote}`,
    }
  }
  if (nominal > 0 && qty - nominal > 1e-9) {
    return {
      ok: false,
      level: 'error',
      message: `${summary}。下达数量 ${qty} 超过公称容积，不能下发。`,
    }
  }
  if (working > 0 && qty - working > 1e-9) {
    return {
      ok: true,
      level: 'warning',
      message: `${summary}。${holdNote}下达数量 ${qty} 超过工作容积，仍可下发。${releaseNote}`,
    }
  }
  return { ok: true, level: 'info', message: `${summary}。${holdNote}${releaseNote}` }
}

function cleanNameList(values) {
  const names = (Array.isArray(values) ? values : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
  return [...new Set(names)]
}

function cleanIdList(values) {
  const ids = (Array.isArray(values) ? values : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

/** 下发前把每步选定的设备和岗位写进配方快照。设备须在工序允许范围内。 */
function applyReleaseStepAssignments(order, steps) {
  if (!Array.isArray(steps)) return
  const allowedPositions = new Set(positionOptions)
  const byNo = new Map(steps.map((row) => [Number(row.stepNo), row]))
  for (const step of order.routeSnapshot || []) {
    const patch = byNo.get(Number(step.stepNo))
    if (!patch) continue
    const equipmentIds = cleanIdList(patch.equipmentIds)
    const proc = step.processId ? getProcessById(step.processId) : null
    const allow = Array.isArray(proc?.equipmentIds) ? proc.equipmentIds.filter(Boolean) : []
    const stepLabel = step.name || step.processName || `步骤${step.stepNo}`
    if (allow.length) {
      const outside = equipmentIds.find((id) => !allow.includes(id))
      if (outside) {
        throw new Error(`${stepLabel} 的设备不在该工序允许的设备里`)
      }
    }
    for (const id of equipmentIds) {
      const device = getDeviceById(id)
      if (
        !device ||
        device.status === EQUIPMENT_STATUS.SCRAPPED ||
        device.status === EQUIPMENT_STATUS.REPAIRING
      ) {
        throw new Error(`${stepLabel} 的设备不可用`)
      }
    }
    const positionNames = cleanNameList(patch.positionNames)
    const unknown = positionNames.find((name) => !allowedPositions.has(name))
    if (unknown) throw new Error(`${stepLabel} 的岗位「${unknown}」不在岗位主数据中`)
    step.equipmentIds = equipmentIds
    step.equipmentId = equipmentIds[0] || ''
    step.equipmentName = equipmentIds
      .map((id) => deviceLabelById(id))
      .filter(Boolean)
      .join('、')
    step.positionNames = positionNames
  }
}

/** 记下每步设备和岗位后下发。产线和反应设备未传入时不改原值，也不强制填写。 */
export function confirmReleaseOrder(id, { productionLineId, reactorTankId, steps } = {}) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status !== 'pending_release') throw new Error('只有待下发指令可以下发')
  const lineId =
    productionLineId === undefined
      ? String(order.productionLineId || '').trim()
      : String(productionLineId || '').trim()
  const line = lineId ? getProductionLineById(lineId) : null
  if (lineId && !line) throw new Error('产线不存在')
  const tankId =
    reactorTankId === undefined
      ? String(order.reactorTankId || '').trim()
      : String(reactorTankId || '').trim()
  if (tankId && line && !(line.equipmentIds || []).includes(tankId)) {
    throw new Error('请选择这条产线上的反应设备')
  }
  if (tankId) {
    const inspection = inspectReactorForRelease(order, tankId)
    if (!inspection.ok) throw new Error(inspection.message)
  }
  applyReleaseStepAssignments(order, steps)
  if (line) {
    order.productionLineId = lineId
    order.executeBy = 'line'
  } else if (!order.productionLineId) {
    order.executeBy = 'formula'
  }
  if (tankId) {
    const saved = updateDevice(tankId, {
      occupyStatus: EQUIPMENT_OCCUPY_STATUS.OCCUPIED,
      occupiedBatchNo: order.batchNo,
    })
    if (!saved.ok) throw new Error(saved.message || '占用反应设备失败')
    order.reactorTankId = tankId
  }
  order.status = 'running'
  appendOperationLog(
    order,
    '指定下发',
    tankId ? getDeviceById(tankId)?.name || '' : line?.name || '',
  )
  return order
}

/** 待下发可改批次号、产线和备注。配方与数量仍用生成时的快照。 */
export function updatePendingOrder(id, { batchNo, productionLineId, remark } = {}) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status !== 'pending_release') throw new Error('只有待下发指令可以编辑')
  const nextNo = String(batchNo || '').trim()
  if (!nextNo) throw new Error('请填写批次号')
  if (batchInstructionState.orders.some((row) => row.id !== id && row.batchNo === nextNo)) {
    throw new Error('批次号已存在')
  }
  const lineId = String(productionLineId || '').trim()
  if (lineId && !getProductionLineById(lineId)) throw new Error('产线不存在')
  order.batchNo = nextNo
  order.productionLineId = lineId
  order.executeBy = lineId ? 'line' : order.executeBy || 'formula'
  order.remark = String(remark || '').trim()
  appendOperationLog(order, '编辑')
  return order
}

/** 待下发且尚未投料、产出时可以删除。 */
export function deletePendingOrder(id) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status !== 'pending_release') throw new Error('只有待下发指令可以删除')
  if ((order.feeds || []).length || (order.outputs || []).length) {
    throw new Error('已有投料或产出，不能删除')
  }
  const index = batchInstructionState.orders.findIndex((row) => row.id === id)
  if (index >= 0) batchInstructionState.orders.splice(index, 1)
  return true
}

/** 停产 / 作废：待下发与执行中均可作废；已完成不可。 */
export function cancelBatchOrder(id) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status === 'done') throw new Error('已完成的指令不能作废')
  if (order.status === 'cancelled') return order
  releaseReactorHold(order)
  order.status = 'cancelled'
  order.cancelledAt = dayjs().format('YYYY-MM-DD HH:mm')
  appendOperationLog(order, '终止')
  return order
}

export function listOrdersByFeedPlan(feedPlanId) {
  if (!feedPlanId) return []
  return batchInstructionState.orders.filter((row) => row.feedPlanId === feedPlanId)
}

function formatFormDisplayValue(value) {
  if (Array.isArray(value)) return value.join('、') || '—'
  if (value === '' || value == null || value === undefined) return '—'
  return value
}

export function confirmStep(id, stepNo, actuals, formValues = {}) {
  const order = getBatchOrder(id)
  if (!order || order.status !== 'running') throw new Error('请先下发批次指令')
  const step = (order.routeSnapshot || []).find((s) => s.stepNo === Number(stepNo))
  if (!step) throw new Error('步骤不存在')
  assertHardGateAllowsConfirm(order, step)
  const params = stepParamRows(step)
  params.forEach((param, index) => {
    const value = actuals?.[index]
    if (value === '' || value == null || value === undefined) return
    const n = Number(value)
    if (param.min != null && param.min !== '' && n < Number(param.min)) {
      throw new Error(`${step.name} 的${param.name}低于下限`)
    }
    if (param.max != null && param.max !== '' && n > Number(param.max)) {
      throw new Error(`${step.name} 的${param.name}高于上限`)
    }
  })

  const formTemplate = resolveStepFormTemplate(step)
  // 固定项（出料量/备注/系统项）始终采集；模板只追加其余字段。实投量仍走投料过账。
  const fields = [
    ...stepConfirmFixedFieldDefs(),
    ...filterTemplateFieldsBeyondFixed(formTemplate?.fields || []),
  ]
  const operatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
  const systemCtx = {
    operatedAt,
    equipmentId: step.equipmentId || '',
    equipmentLabel: step.equipmentName || '',
    batchNo: order.batchNo,
  }
  const resolvedFormRows = []
  fields.forEach((field) => {
    let value = formValues?.[field.code]
    if (isProcessFormSystemField(field)) {
      value = resolveProcessFormSystemValue(field.systemKey, systemCtx)
    }
    const empty =
      value === '' ||
      value == null ||
      value === undefined ||
      (Array.isArray(value) && !value.length)
    if (field.required && empty) {
      throw new Error(`请填写「${field.name || field.code}」`)
    }
    if (empty && !isProcessFormSystemField(field)) return
    const code = String(field.code || '').toUpperCase()
    // 批记录时间戳：优先用补录的操作时间
    const rowAt =
      code === 'OP_OPERATED_AT' && String(value || '').trim()
        ? String(value).trim()
        : String(formValues?.OP_OPERATED_AT || '').trim() || operatedAt
    resolvedFormRows.push({
      stepNo: step.stepNo,
      stepName: step.name || '',
      fieldCode: field.code,
      fieldName: field.name || field.code,
      unit: field.unit || '',
      value,
      displayValue: formatFormDisplayValue(value),
      valueSource: isProcessFormSystemField(field) ? 'system' : 'manual',
      at: rowAt,
    })
  })
  const recordAt = String(formValues?.OP_OPERATED_AT || '').trim() || operatedAt
  const recordOperator =
    String(formValues?.OP_OPERATOR || '').trim() ||
    resolveProcessFormSystemValue('operator', systemCtx)

  order.paramActuals = (order.paramActuals || []).filter((p) => p.stepNo !== step.stepNo)
  const paramRows = []
  params.forEach((param, index) => {
    const value = actuals?.[index]
    if (value === '' || value == null) return
    const row = {
      stepNo: step.stepNo,
      key: param.unit ? `${param.name}（${param.unit}）` : param.name,
      value: Number(value),
    }
    order.paramActuals.push(row)
    paramRows.push(row)
  })

  order.formActuals = (order.formActuals || []).filter((row) => row.stepNo !== step.stepNo)
  order.formActuals.push(...resolvedFormRows)

  // 只替换本步「确认」写入的过程记录，保留投料/化验 EBR
  order.ebrEntries = (order.ebrEntries || []).filter(
    (row) => !(Number(row.stepNo) === Number(step.stepNo) && !row.source),
  )
  order.ebrEntries.push({
    stepNo: step.stepNo,
    stepName: step.name || '',
    templateId: formTemplate?.templateId || '',
    templateName: formTemplate?.templateName || '',
    equipmentText: step.equipmentName || '',
    params: paramRows.map((row) => ({ key: row.key, value: row.value })),
    fields: resolvedFormRows.map((row) => ({
      code: row.fieldCode,
      name: row.fieldName,
      value: row.displayValue,
      valueSource: row.valueSource,
    })),
    operator: recordOperator,
    at: recordAt,
  })

  if (!order.confirmedSteps.includes(step.stepNo)) order.confirmedSteps.push(step.stepNo)
  // 旧批次无快照时，确认后补上，便于详情回看
  if (!step.formTemplate && formTemplate) step.formTemplate = formTemplate
  appendOperationLog(order, '确认工序', step.name || String(step.stepNo))
  return order
}

export function postFeed(id, { batchId, qty, stepNo, contentUsed, feedSource, allowEmptyContent }) {
  const order = getBatchOrder(id)
  if (!order || order.status !== 'running') throw new Error('执行中的指令才能投料')
  const batch = getMaterialBatch(batchId)
  if (!batch) throw new Error('原料批次不存在')
  const line = (order.theoreticalFeeds || []).find((f) => f.itemId === batch.itemId)
  if (!line && !order.reworkOfBatchId && !order.reextractOfBatchId) {
    throw new Error('该原料不在本配方投料明细里')
  }
  const take = round3(qty)
  if (!(take > 0)) throw new Error('实投量须大于 0')
  const hasUserContent = contentUsed != null && contentUsed !== ''
  let content = null
  if (hasUserContent) content = Number(contentUsed)
  else if (!allowEmptyContent && batch.content != null && batch.content !== '') {
    content = Number(batch.content)
  }
  if (line?.convertByContent && !(content > 0) && !allowEmptyContent) {
    throw new Error(`${itemLabel(batch.itemId)} 按含量折算，请填写含量`)
  }
  const source =
    feedSource ||
    (order.reextractOfBatchId ? 'reextract' : batch.status === 'await_reuse' ? 'recycle' : 'fresh')
  if (source === 'recycle') {
    const donor = batchInstructionState.orders.find((o) =>
      (o.outputs || []).some((x) => x.batchId === batch.id),
    )
    const donorOutput = donor?.outputs?.find((x) => x.batchId === batch.id)
    if (donor && donorOutput) assertSideOutputAssayAllowsUse(donor, donorOutput)
  }
  consumeBatchQty(batchId, take, { orderId: order.id, orderNo: order.batchNo }, order, source)
  const isRecycle = source === 'recycle' || batch.status === 'await_reuse'
  const isReextract = source === 'reextract' || Boolean(order.reextractOfBatchId)
  const contentPending = Boolean(allowEmptyContent) && !(Number(content) > 0)
  order.feeds.push({
    id: `feed-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    materialBatchId: batch.id,
    batchNo: batch.batchNo,
    itemId: batch.itemId,
    qty: take,
    stepNo: Number(stepNo) || 1,
    contentUsed: content,
    contentPending,
    locationId: batch.locationId || '',
    isRecycle,
    isReextract,
    feedSource: source,
    operator: currentOperator(),
    at: dayjs().format('YYYY-MM-DD HH:mm'),
  })
  appendOperationLog(
    order,
    isReextract ? '再提投料' : isRecycle ? '回流投料' : '投料',
    `${itemLabel(batch.itemId)} ${take}${contentPending ? '（含量待化验回填）' : ''}`,
  )
  return order
}

/** 按投料明细一次过账多行（实投 + 含量），扣库存；fifo 行按指定库位先进先出拆批 */
export function postFeeds(id, lines = []) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  const expanded = []
  ;(lines || []).forEach((row) => {
    if (!row || !(Number(row.qty) > 0)) return
    if (row.fifo && row.itemId) {
      const locationId = String(row.locationId || '').trim()
      if (!locationId) throw new Error(`${itemLabel(row.itemId)} 请选择来源库位（储罐/仓库）`)
      const allocs = planFeedFifoAllocations(row.itemId, row.qty, order, {
        source: row.feedSource || 'fresh',
        locationId,
      })
      const allowEmpty = Boolean(row.allowEmptyContent)
      const hasUserContent = row.contentUsed != null && row.contentUsed !== ''
      allocs.forEach((alloc) => {
        expanded.push({
          batchId: alloc.batchId,
          qty: alloc.qty,
          stepNo: row.stepNo,
          // FIFO 盲投：不把批次含量塞回去，留给化验回填
          contentUsed: hasUserContent ? row.contentUsed : null,
          allowEmptyContent: allowEmpty || !hasUserContent,
          feedSource: row.feedSource || 'fresh',
        })
      })
      return
    }
    if (row.batchId) {
      expanded.push({
        batchId: row.batchId,
        qty: row.qty,
        stepNo: row.stepNo,
        contentUsed: row.contentUsed,
        allowEmptyContent: false,
        feedSource: row.feedSource,
      })
    }
  })
  if (!expanded.length) throw new Error('请至少填写一行实投量')
  expanded.forEach((row) => {
    postFeed(id, {
      batchId: row.batchId,
      qty: row.qty,
      stepNo: row.stepNo,
      contentUsed: row.contentUsed,
      feedSource: row.feedSource,
      allowEmptyContent: row.allowEmptyContent,
    })
  })
  return getBatchOrder(id)
}

/**
 * 回填/补录投料含量。content 按 0~1 小数存储（与 contentUsed 一致）。
 * 可按 feedId 精确补录，或按步骤/物料批量回填待补行。
 */
export function backfillFeedContentFromAssay(orderId, { stepNo, itemId, content, feedId } = {}) {
  const order = getBatchOrder(orderId)
  if (!order) return { ok: false, updated: 0, message: '批次指令不存在' }
  const frac = Number(content)
  if (!Number.isFinite(frac) || !(frac > 0)) {
    return { ok: false, updated: 0, message: '请填写有效含量' }
  }
  const step = Number(stepNo)
  const targetId = String(feedId || '').trim()
  let updated = 0
  ;(order.feeds || []).forEach((feed) => {
    if (targetId) {
      if (String(feed.id || '') !== targetId) return
    } else {
      if (step > 0 && Number(feed.stepNo) !== step) return
      if (itemId && feed.itemId !== itemId) return
      if (!feed.contentPending && feed.contentUsed != null && feed.contentUsed !== '') return
    }
    feed.contentUsed = frac
    feed.contentPending = false
    updated += 1
  })
  if (updated) {
    appendOperationLog(
      order,
      '含量回填',
      targetId ? `补录投料含量 ${updated} 行` : `步骤 ${step || '—'} 回填 ${updated} 行投料含量`,
    )
  }
  return { ok: true, updated }
}

function extractContentFractionFromQcTask(task) {
  for (const line of task?.lineItems || []) {
    if (line.content != null && line.content !== '') {
      const n = Number(line.content)
      if (Number.isFinite(n) && n > 0) return Math.abs(n) <= 1 ? n : n / 100
    }
  }
  const bags = []
  if (Array.isArray(task?.templateFields)) bags.push(task.templateFields)
  ;(task?.lineItems || []).forEach((line) => {
    if (Array.isArray(line.templateFields)) bags.push(line.templateFields)
  })
  for (const fields of bags) {
    for (const field of fields) {
      const label = `${field?.name || ''}${field?.code || ''}${field?.label || ''}`
      if (!/含量|content|品位|浓度|assay/i.test(label)) continue
      const raw = field.value ?? field.actual ?? field.result
      const n = Number(raw)
      if (!Number.isFinite(n) || !(n > 0)) continue
      return Math.abs(n) <= 1 ? n : n / 100
    }
  }
  return null
}

export function postOutput(id, { rows, locationId, deviation, stepNo }) {
  const order = getBatchOrder(id)
  if (!order || order.status !== 'running') throw new Error('执行中的指令才能产出入库')
  const step = Number(stepNo)
  const expected = order.expectedOutputs || []
  const created = []
  ;(rows || []).forEach((row) => {
    const qty = round3(row.qty)
    if (!(qty > 0)) return
    const plan = expected.find(
      (line) => line.itemId === row.itemId && (!row.role || line.role === row.role),
    )
    if (expected.length && !plan && !order.reworkOfBatchId && !order.reextractOfBatchId) {
      throw new Error(`${itemLabel(row.itemId)} 不在本配方产出明细里`)
    }
    if (step > 0 && plan?.stepNo && Number(plan.stepNo) !== step) {
      throw new Error(
        `${itemLabel(row.itemId)} 计划在「${plan.stepName || plan.stepNo}」产出，请切换阶段`,
      )
    }
    const role = row.role || plan?.role || 'by'
    const disposition = normalizeOutputDisposition(row.disposition)
    if (!disposition) throw new Error(`${itemLabel(row.itemId)} 请选择处理方式`)
    const makeBatch = createsOutputBatchDisposition(disposition)
    const rowLocation = makeBatch ? row.locationId || locationId : ''
    if (makeBatch && !rowLocation) {
      const tip =
        disposition === 'tank' ? '储罐' : disposition === 'warehouse' ? '仓库' : '去向位置'
      throw new Error(`${itemLabel(row.itemId)} 请选择${tip}`)
    }
    if (makeBatch) {
      const tank = listTanks().find((item) => item.id === rowLocation)
      if (!tank) throw new Error(`${itemLabel(row.itemId)} 去向位置不存在`)
      const needKind = locationKindForDisposition(disposition)
      const actualKind = tank.kind === 'tank' ? 'tank' : 'silo'
      if (needKind && actualKind !== needKind) {
        throw new Error(
          disposition === 'tank'
            ? `${itemLabel(row.itemId)} 入储罐请选择储罐`
            : `${itemLabel(row.itemId)} 入仓库请选择仓库或料仓`,
        )
      }
    }
    const roleCode = { main: 'FG', co: 'CO', by: 'BY', recycle: 'RC', waste: 'WS' }[role] || 'BY'
    const seq =
      (order.outputs || []).filter((o) => o.role === role).length +
      created.filter((o) => o.role === role).length +
      1
    const batchNo = `${order.batchNo}-${roleCode}${seq > 1 ? `-${seq}` : ''}`
    const batchStatus = batchStatusForDisposition(disposition)
    const movementType =
      disposition === 'reuse'
        ? '产出回用'
        : disposition === 'reextract'
          ? '产出再提'
          : disposition === 'pending_decide'
            ? '产出待判定'
            : disposition === 'scrap'
              ? '产出废弃'
              : '产出入库'
    const batch = makeBatch
      ? addOutputBatch({
          itemId: row.itemId,
          qty,
          locationId: rowLocation,
          batchNo,
          status: batchStatus,
          disposition,
          sourceType:
            disposition === 'reuse' ||
            disposition === 'reextract' ||
            disposition === 'pending_decide' ||
            disposition === 'scrap'
              ? disposition
              : 'output',
          movementType,
          sourceId: order.id,
          previousBatchId: order.reworkOfBatchId || order.reextractOfBatchId || '',
        })
      : null
    const assayScopes = normalizeOutputAssayScopes(row.assayScopes)
    created.push({
      id: `out-${Date.now()}-${created.length}`,
      role,
      itemId: row.itemId,
      qty,
      disposition,
      batchId: batch?.id || '',
      batchNo: batch?.batchNo || '',
      locationId: rowLocation,
      stepNo: step > 0 ? step : plan?.stepNo || null,
      assayScopes,
      assayHardGate: Boolean(row.assayHardGate) || assayScopes.length > 0,
      at: dayjs().format('YYYY-MM-DD HH:mm'),
    })
  })
  if (!created.length) throw new Error('请至少填写一行实际产出')
  const inboundRows = created.filter((row) => isStockOutputDisposition(row.disposition))
  const inbound = inboundRows.length ? createOutputInboundOrder(order, inboundRows) : null
  if (inbound) {
    inboundRows.forEach((row) => {
      row.inboundOrderId = inbound.id
      row.inboundOrderNo = inbound.docNo
    })
  }
  order.outputs = [...(order.outputs || []), ...created]
  const mainQty = round3(
    order.outputs.filter((r) => r.role === 'main').reduce((sum, r) => sum + Number(r.qty || 0), 0),
  )
  order.actualOutput = mainQty > 0 ? mainQty : order.actualOutput || 0
  order.yieldGap = yieldGap(order.actualOutput, order.theoreticalOutput)
  if (deviation != null && deviation !== '') order.deviation = deviation
  const dispositionText = ['pending_decide', 'warehouse', 'tank', 'reuse', 'reextract', 'scrap']
    .map((key) => {
      const count = created.filter((row) => row.disposition === key).length
      return count ? `${OUTPUT_DISPOSITION_LABEL[key]} ${count} 行` : ''
    })
    .filter(Boolean)
    .join('，')
  appendOperationLog(
    order,
    inbound ? '产出入库' : '产出登记',
    inbound ? `${dispositionText}，入库单 ${inbound.docNo}` : dispositionText,
  )
  return order
}

/** 产出过账同时记一张已入库单。每行可以进不同罐或仓。 */
function createOutputInboundOrder(order, created) {
  const locationName = (id) => listTanks().find((row) => row.id === id)?.name || ''
  const names = [...new Set(created.map((row) => locationName(row.locationId)).filter(Boolean))]
  const warehouse = names.length === 1 ? names[0] : names.join('、')
  const who = currentOperator()
  const hasMain = created.some((row) => row.role === 'main')
  return addInboundOrder({
    inboundType: hasMain ? '成品入库' : '半成品入库',
    status: '已入库',
    warehouse,
    itemType: '产品',
    sourceOrderNo: order.batchNo,
    sourceType: '批次指令',
    creator: who,
    handler: who,
    confirmer: who,
    confirmedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    remark: `批次指令 ${order.batchNo} 产出入库`,
    inboundDate: dayjs().format('YYYY-MM-DD'),
    workOrders: [
      {
        workOrderNo: order.batchNo,
        workOrderId: order.id,
        qty: created.reduce((sum, row) => sum + Number(row.qty || 0), 0),
      },
    ],
    lineItems: created.map((row) => {
      const card = itemMasterCard(row.itemId)
      return createInboundLine({
        itemCode: card.code || '',
        itemName: card.name || itemLabel(row.itemId),
        specModel: card.specModel || '',
        qty: row.qty,
        unit: itemUnit(row.itemId) || order.unit || 'kg',
        warehouse: locationName(row.locationId) || warehouse,
        lineSource: '生产',
        lineStatus: '已入库',
        barcodeBatchNo: row.batchNo,
        sourceDocNo: order.batchNo,
        productionDate: dayjs().format('YYYY-MM-DD'),
      })
    }),
  })
}

export function completionErrors(order) {
  if (!order) return ['指令不存在']
  const errors = []
  const steps = order.routeSnapshot || []
  if (steps.some((s) => !order.confirmedSteps.includes(s.stepNo))) errors.push('还有步骤未确认')
  if (!order.feeds.length) errors.push('实际投料尚未记账')
  ;(order.theoreticalFeeds || []).forEach((line) => {
    if (line.tolerance == null || line.tolerance === '') return
    const tol = Number(line.tolerance)
    if (!(tol >= 0) || !(Number(line.qty) > 0)) return
    const actual = round3(
      (order.feeds || [])
        .filter((feed) => feed.itemId === line.itemId)
        .reduce((sum, feed) => sum + Number(feed.qty), 0),
    )
    const low = round3(Number(line.qty) * (1 - tol))
    const high = round3(Number(line.qty) * (1 + tol))
    if (actual < low || actual > high) {
      errors.push(`${itemLabel(line.itemId)} 实际投料 ${actual} kg 超出允差 ${low}~${high} kg`)
    }
  })
  const expected = order.expectedOutputs || []
  if (!expected.length) {
    if (!order.outputs?.length) errors.push('产出尚未入库')
  } else {
    expected.forEach((line) => {
      if (!(Number(line.qty) > 0)) return
      const posted = round3(
        (order.outputs || [])
          .filter((o) => o.itemId === line.itemId && o.role === line.role)
          .reduce((sum, o) => sum + Number(o.qty || 0), 0),
      )
      if (!(posted > 0)) {
        errors.push(
          `${OUTPUT_ROLE_LABEL?.[line.role] || line.role || '产出'} ${itemLabel(line.itemId)} 尚未产出入库`,
        )
      }
    })
  }
  return errors
}

export function completeOrder(id) {
  const order = getBatchOrder(id)
  const errors = completionErrors(order)
  if (errors.length) throw new Error(errors.join('；'))
  releaseReactorHold(order)
  order.status = 'done'
  order.completedAt = dayjs().format('YYYY-MM-DD HH:mm')
  appendOperationLog(order, '完成')
  return order
}

/** 产出化验硬门禁：有关联待检或不合格时，不能回流投料 / 开再提。 */
export function assertSideOutputAssayAllowsUse(order, outputRow) {
  if (!order || !outputRow) return
  const hard =
    outputRow.assayHardGate === true ||
    (Array.isArray(outputRow.assayScopes) && outputRow.assayScopes.length > 0) ||
    (order.outputQcRecords || []).some(
      (row) =>
        row.itemId === outputRow.itemId &&
        row.role === outputRow.role &&
        Number(row.stepNo) === Number(outputRow.stepNo),
    )
  if (!hard) return
  const records = (order.outputQcRecords || []).filter(
    (row) =>
      row.itemId === outputRow.itemId &&
      (!outputRow.role || row.role === outputRow.role) &&
      (!outputRow.stepNo || Number(row.stepNo) === Number(outputRow.stepNo)),
  )
  if (!records.length) {
    throw new Error(`${itemLabel(outputRow.itemId)} 已勾选产出化验，请先完成化验再回用或再提`)
  }
  const { getQcTaskById: loadQc } = require('@/store/qcTaskStore')
  for (const row of records) {
    const task = row.taskId ? loadQc(row.taskId) : null
    const status = task?.qcStatus || row.qcStatus || ''
    const result = task?.qcResult || row.qcResult || ''
    if (!status || /待|draft|pending/i.test(String(status))) {
      throw new Error(`${itemLabel(outputRow.itemId)} 产出化验未完成，不能回用或再提`)
    }
    if (/不通过|不合格|FAIL/i.test(String(result))) {
      throw new Error(`${itemLabel(outputRow.itemId)} 产出化验不合格，不能回用或再提`)
    }
  }
}

/**
 * 待判定批次确认最终去向：入仓库 / 入储罐 / 回用 / 再提 / 废弃。
 */
export function confirmOutputDisposition(orderId, { outputId, batchId, disposition, locationId }) {
  const order = getBatchOrder(orderId)
  if (!order) throw new Error('指令不存在')
  const output =
    (order.outputs || []).find((row) => row.id === outputId) ||
    (order.outputs || []).find((row) => row.batchId === batchId)
  if (!output) throw new Error('产出行不存在')
  const batch = getMaterialBatch(output.batchId || batchId)
  if (!batch) throw new Error('产出批次不存在')
  if (batch.status !== 'await_decide' && output.disposition !== 'pending_decide') {
    throw new Error('只有待判定产出才能确认去向')
  }
  const next = normalizeOutputDisposition(disposition)
  if (!next || next === 'pending_decide') throw new Error('请选择最终处理方式')
  if (!createsOutputBatchDisposition(next) || next === 'pending_decide') {
    throw new Error('处理方式不正确')
  }
  const loc = locationId || output.locationId || batch.locationId
  if (!loc) throw new Error('请选择去向位置')
  const tank = listTanks().find((item) => item.id === loc)
  if (!tank) throw new Error('去向位置不存在')
  const needKind = locationKindForDisposition(next)
  const actualKind = tank.kind === 'tank' ? 'tank' : 'silo'
  if (needKind && actualKind !== needKind) {
    throw new Error(next === 'tank' ? '入储罐请选择储罐' : '入仓库请选择仓库或料仓')
  }
  // 回用/再提去向可先确认；硬门禁在回流投料列表 / 开再提指令时拦截。
  output.disposition = next
  output.locationId = loc
  batch.disposition = next
  batch.locationId = loc
  batch.status = batchStatusForDisposition(next)
  batch.sourceType =
    next === 'warehouse' || next === 'tank' ? 'output' : next === 'scrap' ? 'scrap' : next
  let inbound = null
  if (isStockOutputDisposition(next)) {
    inbound = createOutputInboundOrder(order, [output])
    output.inboundOrderId = inbound.id
    output.inboundOrderNo = inbound.docNo
  }
  appendOperationLog(
    order,
    '确认产出去向',
    `${itemLabel(output.itemId)} → ${OUTPUT_DISPOSITION_LABEL[next]}${
      inbound ? `，入库单 ${inbound.docNo}` : ''
    }`,
  )
  return { order, batch, inbound }
}

/** 待判定 / 待回用 / 待再提产出汇总，供待处置菜单。 */
export function listPendingDispositionOutputs() {
  const statuses = new Set(['await_decide', 'await_reuse', 'await_reextract'])
  const rows = []
  batchInstructionState.orders.forEach((order) => {
    ;(order.outputs || []).forEach((output) => {
      const batch = getMaterialBatch(output.batchId)
      if (!batch || !statuses.has(batch.status)) return
      if (!(Number(batch.qty) > 0)) return
      rows.push({
        key: `${order.id}-${output.id || output.batchId}`,
        orderId: order.id,
        orderNo: order.batchNo,
        outputId: output.id,
        batchId: batch.id,
        batchNo: batch.batchNo,
        itemId: output.itemId || batch.itemId,
        role: output.role,
        disposition: output.disposition || batch.disposition,
        locationId: batch.locationId || output.locationId,
        qty: batch.qty,
        unit: batch.unit,
        status: batch.status,
        stepNo: output.stepNo,
        at: output.at,
        assayHardGate: Boolean(output.assayHardGate),
      })
    })
  })
  return rows.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
}

export function createRework({ sourceBatchId, qty }) {
  const src = getMaterialBatch(sourceBatchId)
  if (!src) throw new Error('原批次不存在')
  if (src.status !== 'released') throw new Error('只能对已放行批次返工')
  const take = round3(qty)
  if (!(take > 0) || take > Number(src.qty) + 1e-9)
    throw new Error('返工批量不能超过原批次剩余重量')
  const origin = batchInstructionState.orders.find((o) =>
    o.outputs?.some((x) => x.batchId === src.id),
  )
  const formula = origin ? getFormula(origin.formulaId) : null
  const batchNo = nextBatchNo()
  const order = {
    id: `bo-rw-${Date.now()}`,
    batchNo,
    status: 'running',
    seq: 1,
    batchCount: 1,
    qty: take,
    unit: src.unit || 'kg',
    formulaId: formula?.id || '',
    formulaVersion: formula?.version || '',
    formulaName: formula ? `${formula.name} 返工` : '返工',
    itemId: src.itemId,
    theoreticalOutput: formula ? round3(take * Number(formula.theoreticalYield)) : take,
    theoreticalFeeds: [{ itemId: src.itemId, qty: take, feedSequence: 1, convertByContent: false }],
    expectedOutputs: [{ role: 'main', itemId: src.itemId, qty: take }],
    routeSnapshot: snapshotSteps(formula?.steps || [{ stepNo: 1, name: '再加工', setpoints: {} }]),
    equipmentRoute: snapshotEquipmentRoute(formula),
    feeds: [],
    paramActuals: [],
    formActuals: [],
    ebrEntries: [],
    stepQcMap: {},
    confirmedSteps: [],
    outputs: [],
    actualOutput: null,
    yieldGap: null,
    deviation: '',
    remark: '',
    reworkOfBatchId: src.id,
    reextractOfBatchId: '',
    sourceLabel: `返工 ${src.batchNo}`,
    demandQty: take,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    createdBy: currentOperator(),
  }
  appendOperationLog(order, '生成返工指令', src.batchNo || '')
  batchInstructionState.orders.unshift(order)
  return order
}

/** 对待再提批次开再提指令：投料扣这批，产出记前后批次。 */
export function createReextract({ sourceBatchId, qty }) {
  const src = getMaterialBatch(sourceBatchId)
  if (!src) throw new Error('原批次不存在')
  if (src.status !== 'await_reextract') throw new Error('只能对待再提批次开再提指令')
  if (!(Number(src.qty) > 0)) throw new Error('待再提批次已无剩余量')
  const take = round3(qty != null && qty !== '' ? qty : src.qty)
  if (!(take > 0) || take > Number(src.qty) + 1e-9) {
    throw new Error('再提批量不能超过待再提批次剩余量')
  }
  const origin = batchInstructionState.orders.find((o) =>
    o.outputs?.some((x) => x.batchId === src.id),
  )
  const originOutput = origin?.outputs?.find((x) => x.batchId === src.id)
  if (origin && originOutput) assertSideOutputAssayAllowsUse(origin, originOutput)
  const formula = origin ? getFormula(origin.formulaId) : null
  const batchNo = nextBatchNo()
  const order = {
    id: `bo-rx-${Date.now()}`,
    batchNo,
    status: 'running',
    seq: 1,
    batchCount: 1,
    qty: take,
    unit: src.unit || 'kg',
    formulaId: formula?.id || '',
    formulaVersion: formula?.version || '',
    formulaName: formula ? `${formula.name} 再提` : '再提',
    itemId: origin?.itemId || src.itemId,
    theoreticalOutput: formula ? round3(take * Number(formula.theoreticalYield || 1)) : take,
    theoreticalFeeds: [{ itemId: src.itemId, qty: take, feedSequence: 1, convertByContent: false }],
    expectedOutputs: [{ role: 'main', itemId: origin?.itemId || src.itemId, qty: take }],
    routeSnapshot: snapshotSteps(formula?.steps || [{ stepNo: 1, name: '再提', setpoints: {} }]),
    equipmentRoute: snapshotEquipmentRoute(formula),
    feeds: [],
    paramActuals: [],
    formActuals: [],
    ebrEntries: [],
    stepQcMap: {},
    confirmedSteps: [],
    outputs: [],
    actualOutput: null,
    yieldGap: null,
    deviation: '',
    remark: '',
    reworkOfBatchId: '',
    reextractOfBatchId: src.id,
    sourceLabel: `再提 ${src.batchNo}`,
    demandQty: take,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    createdBy: currentOperator(),
  }
  appendOperationLog(order, '生成再提指令', src.batchNo || '')
  batchInstructionState.orders.unshift(order)
  return order
}

export function releaseOutputBatch(batchId) {
  const order = batchInstructionState.orders.find((row) =>
    (row.outputs || []).some((item) => item.batchId === batchId),
  )
  const result = setBatchStatus(batchId, 'released')
  if (order) appendOperationLog(order, '成品放行', getMaterialBatch(batchId)?.batchNo || '')
  return result
}

export function listFeeds() {
  return batchInstructionState.orders.flatMap((order) =>
    (order.feeds || []).map((feed) => ({ ...feed, orderId: order.id, orderNo: order.batchNo })),
  )
}

export function traceByBatch(batchId) {
  const batch = getMaterialBatch(batchId)
  const asFeed = listFeeds().filter((f) => f.materialBatchId === batchId)
  const asOutput = batchInstructionState.orders.filter((o) =>
    (o.outputs || []).some((x) => x.batchId === batchId),
  )
  const rework = batchInstructionState.orders.filter((o) => o.reworkOfBatchId === batchId)
  const reextract = batchInstructionState.orders.filter((o) => o.reextractOfBatchId === batchId)
  return { batch, asFeed, asOutput, rework, reextract }
}
