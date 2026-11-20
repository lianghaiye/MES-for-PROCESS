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
  isAssaySchemeHardGate,
  normalizeProcessQcConfigs,
  resolveAssaySchemesForStep,
} from '@/utils/qcProcessConfig'
import {
  isProcessFormSystemField,
  resolveProcessFormSystemValue,
} from '@/utils/processFormSystemField'
import {
  addOutputBatch,
  consumeBatchQty,
  getMaterialBatch,
  listTanks,
  setBatchStatus,
} from '@/store/materialBatchStore'
import { addInboundOrder } from '@/store/inboundOrderStore'
import { createInboundLine } from '@/mock/inboundOrders'
import { appendOperationLog, currentOperator } from '@/utils/operationLog'

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
    return {
      ...order,
      formActuals: Array.isArray(order.formActuals) ? order.formActuals : [],
      ebrEntries: Array.isArray(order.ebrEntries) ? order.ebrEntries : [],
      stepQcMap: order.stepQcMap && typeof order.stepQcMap === 'object' ? order.stepQcMap : {},
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

let seq = 1

function nextBatchNo() {
  seq += 1
  return `BO${dayjs().format('YYYYMMDD')}${String(seq).padStart(3, '0')}`
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
    }
  })
}

function snapshotSteps(steps) {
  return (steps || []).map((step) => {
    const proc = step.processId ? getProcessById(step.processId) : null
    const assaySchemes = normalizeProcessQcConfigs(proc?.qcConfigs || [])
    const equipmentIds = Array.isArray(step.equipmentIds)
      ? step.equipmentIds.map((id) => String(id || '').trim()).filter(Boolean)
      : []
    const equipmentId = String(step.equipmentId || equipmentIds[0] || '').trim()
    return {
      ...JSON.parse(JSON.stringify(step)),
      processCode: step.processCode || proc?.code || '',
      processName: step.name || proc?.name || '',
      gateMode: normalizeProcessGate(step.gateMode || proc?.gateMode),
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
  const schemes = resolveAssaySchemesForStep(step, proc)
  const hardSchemes = schemes.filter((s) => isAssaySchemeHardGate(s))
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

export function createOrdersFromDemand({ formulaId, demandQty, sourceLabel }) {
  const formula = getFormula(formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择一张生效配方')
  const count = planBatchCount(demandQty, formula.baseBatchQty)
  if (!count) throw new Error('需求量和基准批量都必须大于 0')
  const created = []
  for (let i = 1; i <= count; i += 1) {
    const batchNo = nextBatchNo()
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
      reworkOfBatchId: '',
      feedPlanId: '',
      productionLineId: '',
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
}) {
  const formula = getFormula(formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择一张生效配方')
  const qty = round3(plannedQty)
  if (!(qty > 0)) throw new Error('计划投料量须大于 0')
  const scaled = scaleFeedSnapshots(formula, qty)
  const batchNo = nextBatchNo()
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

/** 停产 / 作废：待下发与执行中均可作废；已完成不可。 */
export function cancelBatchOrder(id) {
  const order = getBatchOrder(id)
  if (!order) throw new Error('批次指令不存在')
  if (order.status === 'done') throw new Error('已完成的指令不能作废')
  if (order.status === 'cancelled') return order
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
  // 实投量改由投料过账按明细填写；旧模板快照里若仍带 OP_ACTUAL_FEED 则忽略
  const fields = (formTemplate?.fields || []).filter(
    (field) => String(field.code || '').toUpperCase() !== 'OP_ACTUAL_FEED',
  )
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
    resolvedFormRows.push({
      stepNo: step.stepNo,
      stepName: step.name || '',
      fieldCode: field.code,
      fieldName: field.name || field.code,
      unit: field.unit || '',
      value,
      displayValue: formatFormDisplayValue(value),
      valueSource: isProcessFormSystemField(field) ? 'system' : 'manual',
      at: operatedAt,
    })
  })

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
    operator: resolveProcessFormSystemValue('operator', systemCtx),
    at: operatedAt,
  })

  if (!order.confirmedSteps.includes(step.stepNo)) order.confirmedSteps.push(step.stepNo)
  // 旧批次无快照时，确认后补上，便于详情回看
  if (!step.formTemplate && formTemplate) step.formTemplate = formTemplate
  appendOperationLog(order, '确认工序', step.name || String(step.stepNo))
  return order
}

export function postFeed(id, { batchId, qty, stepNo, contentUsed }) {
  const order = getBatchOrder(id)
  if (!order || order.status !== 'running') throw new Error('执行中的指令才能投料')
  const batch = getMaterialBatch(batchId)
  if (!batch) throw new Error('原料批次不存在')
  const line = (order.theoreticalFeeds || []).find((f) => f.itemId === batch.itemId)
  if (!line && !order.reworkOfBatchId) throw new Error('该原料不在本配方投料明细里')
  const take = round3(qty)
  if (!(take > 0)) throw new Error('实投量须大于 0')
  const content =
    contentUsed != null && contentUsed !== ''
      ? Number(contentUsed)
      : batch.content != null && batch.content !== ''
        ? Number(batch.content)
        : null
  if (line?.convertByContent && !(content > 0)) {
    throw new Error(`${itemLabel(batch.itemId)} 按含量折算，请填写含量`)
  }
  consumeBatchQty(batchId, take, { orderId: order.id, orderNo: order.batchNo })
  order.feeds.push({
    materialBatchId: batch.id,
    batchNo: batch.batchNo,
    itemId: batch.itemId,
    qty: take,
    stepNo: Number(stepNo) || 1,
    contentUsed: content,
    operator: currentOperator(),
    at: dayjs().format('YYYY-MM-DD HH:mm'),
  })
  appendOperationLog(order, '投料', `${itemLabel(batch.itemId)} ${take}`)
  return order
}

/** 按投料明细一次过账多行（实投 + 含量），扣库存 */
export function postFeeds(id, lines = []) {
  const rows = (lines || []).filter((row) => row && row.batchId && Number(row.qty) > 0)
  if (!rows.length) throw new Error('请至少填写一行实投量')
  rows.forEach((row) => {
    postFeed(id, {
      batchId: row.batchId,
      qty: row.qty,
      stepNo: row.stepNo,
      contentUsed: row.contentUsed,
    })
  })
  return getBatchOrder(id)
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
    if (expected.length && !plan && !order.reworkOfBatchId) {
      throw new Error(`${itemLabel(row.itemId)} 不在本配方产出明细里`)
    }
    if (step > 0 && plan?.stepNo && Number(plan.stepNo) !== step) {
      throw new Error(
        `${itemLabel(row.itemId)} 计划在「${plan.stepName || plan.stepNo}」产出，请切换阶段`,
      )
    }
    const role = row.role || plan?.role || 'by'
    const roleCode = { main: 'FG', co: 'CO', by: 'BY', recycle: 'RC', waste: 'WS' }[role] || 'BY'
    const seq = (order.outputs || []).filter((o) => o.role === role).length + 1
    const batch = addOutputBatch({
      itemId: row.itemId,
      qty,
      locationId,
      batchNo: `${order.batchNo}-${roleCode}${seq > 1 ? `-${seq}` : ''}`,
      sourceId: order.id,
      previousBatchId: order.reworkOfBatchId || '',
    })
    created.push({
      role,
      itemId: row.itemId,
      qty,
      batchId: batch.id,
      batchNo: batch.batchNo,
      stepNo: step > 0 ? step : plan?.stepNo || null,
      at: dayjs().format('YYYY-MM-DD HH:mm'),
    })
  })
  if (!created.length) throw new Error('请至少填写一行实际产出')
  const inbound = createOutputInboundOrder(order, created, locationId)
  created.forEach((row) => {
    row.inboundOrderId = inbound.id
    row.inboundOrderNo = inbound.docNo
  })
  order.outputs = [...(order.outputs || []), ...created]
  const mainQty = round3(
    order.outputs.filter((r) => r.role === 'main').reduce((sum, r) => sum + Number(r.qty || 0), 0),
  )
  order.actualOutput = mainQty > 0 ? mainQty : order.actualOutput || 0
  order.yieldGap = yieldGap(order.actualOutput, order.theoreticalOutput)
  if (deviation != null && deviation !== '') order.deviation = deviation
  appendOperationLog(order, '产出入库', `${created.length} 行，入库单 ${inbound.docNo}`)
  return order
}

/** 产出过账同时记一张已入库单。去向批号是罐内物料批，入库单号是这张单据。 */
function createOutputInboundOrder(order, created, locationId) {
  const warehouse = listTanks().find((row) => row.id === locationId)?.name || ''
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
        warehouse,
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
  order.status = 'done'
  order.completedAt = dayjs().format('YYYY-MM-DD HH:mm')
  appendOperationLog(order, '完成')
  return order
}

export function createRework({ sourceBatchId, qty }) {
  const src = getMaterialBatch(sourceBatchId)
  if (!src) throw new Error('原批次不存在')
  if (src.status !== 'released') throw new Error('只能对合格批次返工')
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
    reworkOfBatchId: src.id,
    sourceLabel: `返工 ${src.batchNo}`,
    demandQty: take,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    createdBy: currentOperator(),
  }
  appendOperationLog(order, '生成返工指令', src.batchNo || '')
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
  return { batch, asFeed, asOutput, rework }
}
