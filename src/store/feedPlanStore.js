import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { persistJson } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'
import {
  batchInstructionState,
  cancelBatchOrder,
  createTankChargeFromPlan,
  listOrdersByFeedPlan,
} from '@/store/batchInstructionStore'
import { getMaterialBatch } from '@/store/materialBatchStore'
import { getFormula } from '@/store/processFormulaStore'
import {
  buildFeedPlanPeriod,
  defaultPlanName,
  dateInPeriod,
  distributeTargetQty,
  FEED_PLAN_PERIOD,
  FEED_PLAN_PERIOD_LABEL,
  FEED_PLAN_SOURCE,
  FEED_PLAN_SPLIT,
  listChildPeriods,
  parentPeriodType,
  periodCovers,
  splitTargetPeriodType,
} from '@/utils/feedPlanPeriod'
import { roundNumber } from '@/utils/numberFormat'
import { round3, splitPlanFeedQty, theoreticalOutput } from '@/utils/processBatchMath'
import { appendOperationLog, AUTO_ACTOR } from '@/utils/operationLog'
import { sumShiftReportsInRange } from '@/store/shiftEnergyReportStore'

dayjs.extend(isoWeek)

const STORAGE_KEY = 'i_doms_feed_plans'
const AUTO_RELEASE_KEY = 'i_doms_feed_plan_auto_release'
const PLAN_NO_SEQ_KEY = 'i_doms_feed_plan_no_seq'

function currentOperator() {
  const user = getUser()
  return String(user?.displayName || user?.username || user?.name || 'admin')
}

function nextRootPlanNo(at = dayjs()) {
  const dayKey = at.format('YYYYMMDD')
  let bag = {}
  try {
    bag = JSON.parse(localStorage.getItem(PLAN_NO_SEQ_KEY) || '{}') || {}
  } catch {
    bag = {}
  }
  const seq = (Number(bag[dayKey]) || 0) + 1
  bag[dayKey] = seq
  persistJson(PLAN_NO_SEQ_KEY, bag)
  return `PP${dayKey}${String(seq).padStart(3, '0')}`
}

function childPlanNo(parentNo, index) {
  return `${parentNo}-${String(index).padStart(2, '0')}`
}

function ensurePlanNumbers(plans) {
  const list = Array.isArray(plans) ? plans : []
  const byId = new Map(list.map((row) => [row.id, row]))
  list.forEach((row) => {
    if (!row.source) row.source = FEED_PLAN_SOURCE.MPS
    if (row.sourceRef == null) row.sourceRef = ''
    if (row.planNo) return
    if (row.parentId && byId.has(row.parentId)) return
    row.planNo = nextRootPlanNo(dayjs(row.createdAt || row.start || undefined))
    row.rootPlanNo = row.planNo
  })
  list.forEach((row) => {
    if (row.planNo || !row.parentId) return
    const parent = byId.get(row.parentId)
    if (!parent?.planNo) return
    const siblings = list
      .filter((item) => item.parentId === row.parentId)
      .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    const index = siblings.findIndex((item) => item.id === row.id) + 1
    row.planNo = childPlanNo(parent.planNo, index || 1)
    row.rootPlanNo = parent.rootPlanNo || parent.planNo
  })
  return list
}

const SEED_VERSION_KEY = 'i_doms_feed_plan_seed_v'
const CURRENT_SEED_VERSION = '3'

function planSeedRow({
  id,
  planNo,
  formula,
  periodType,
  period,
  workCenterId,
  targetQty,
  parentId,
  rootPlanNo,
  source,
  sourceRef,
  splitTo,
  remark,
  createdAt,
}) {
  const range = periodType === FEED_PLAN_PERIOD.CUSTOM ? [period.start, period.end] : undefined
  return {
    id,
    periodType,
    ...period,
    formulaId: formula.id,
    itemId: formula.itemId,
    workCenterId: workCenterId || '',
    targetQty,
    parentId: parentId || '',
    source,
    sourceRef: sourceRef || '',
    splitTo,
    remark: remark || '',
    planName: defaultPlanName(periodType, period.start, range),
    theoreticalYield: Number(formula.theoreticalYield),
    theoreticalOutput: theoreticalOutput(targetQty, formula.theoreticalYield),
    planNo,
    rootPlanNo: rootPlanNo || planNo,
    createdBy: '系统',
    createdAt,
    executedAt: '',
    executedBy: '',
  }
}

/** 示例计划：挂已有生效配方和工作中心。只补一次，不覆盖已有同编号或同配方同工作中心同期间的计划。 */
function seedPlans() {
  const paint = getFormula('formula-paint')
  const alkyd = getFormula('formula-alkyd')
  const custom = getFormula('formula-custom')
  const month = buildFeedPlanPeriod(FEED_PLAN_PERIOD.MONTH, '2026-11-01')
  const day = buildFeedPlanPeriod(FEED_PLAN_PERIOD.DAY, '2026-11-19')
  const customPeriod = buildFeedPlanPeriod(FEED_PLAN_PERIOD.CUSTOM, null, [
    '2026-11-19',
    '2026-11-21',
  ])
  const rows = []
  if (paint && month) {
    rows.push(
      planSeedRow({
        id: 'fp-seed-paint-month',
        planNo: 'PP-SEED-PAINT-11',
        formula: paint,
        periodType: FEED_PLAN_PERIOD.MONTH,
        period: month,
        workCenterId: 'wc-paint',
        targetQty: 1200,
        source: FEED_PLAN_SOURCE.MPS,
        sourceRef: 'MPS-2026-11',
        splitTo: FEED_PLAN_SPLIT.NONE,
        remark: '配漆车间本月面漆，尚未拆下级。',
        createdAt: '2026-11-18 09:00',
      }),
    )
  }
  if (alkyd && month) {
    const parentNo = 'PP-SEED-ALKYD-11'
    rows.push(
      planSeedRow({
        id: 'fp-seed-alkyd-month',
        planNo: parentNo,
        formula: alkyd,
        periodType: FEED_PLAN_PERIOD.MONTH,
        period: month,
        workCenterId: 'wc-acid-1',
        targetQty: 2000,
        source: FEED_PLAN_SOURCE.REPLENISH,
        sourceRef: 'RP-ALKYD-11',
        splitTo: FEED_PLAN_SPLIT.WEEK,
        remark: '酸浸一线树脂液，已拆到周。',
        createdAt: '2026-11-18 09:10',
      }),
    )
    const weeks = listChildPeriods({ start: month.start, end: month.end }, FEED_PLAN_SPLIT.WEEK)
    const qtys = distributeTargetQty(2000, weeks.length)
    weeks.forEach((period, index) => {
      rows.push(
        planSeedRow({
          id: `fp-seed-alkyd-${period.periodKey}`,
          planNo: childPlanNo(parentNo, index + 1),
          formula: alkyd,
          periodType: FEED_PLAN_PERIOD.WEEK,
          period,
          workCenterId: 'wc-acid-1',
          targetQty: qtys[index],
          parentId: 'fp-seed-alkyd-month',
          rootPlanNo: parentNo,
          source: FEED_PLAN_SOURCE.REPLENISH,
          sourceRef: 'RP-ALKYD-11',
          splitTo: FEED_PLAN_SPLIT.NONE,
          createdAt: '2026-11-18 09:12',
        }),
      )
    })
  }
  if (custom && customPeriod) {
    rows.push(
      planSeedRow({
        id: 'fp-seed-custom',
        planNo: 'PP-SEED-CUS-1119',
        formula: custom,
        periodType: FEED_PLAN_PERIOD.CUSTOM,
        period: customPeriod,
        workCenterId: 'wc-paint',
        targetQty: 60,
        source: FEED_PLAN_SOURCE.TRIAL,
        sourceRef: 'SY-2026-014',
        splitTo: FEED_PLAN_SPLIT.NONE,
        remark: '客户色漆试产，自定义三天，不拆分。',
        createdAt: '2026-11-18 10:00',
      }),
    )
  }
  if (paint && day) {
    rows.push(
      planSeedRow({
        id: 'fp-seed-paint-day',
        planNo: 'PP-SEED-PAINT-D19',
        formula: paint,
        periodType: FEED_PLAN_PERIOD.DAY,
        period: day,
        workCenterId: 'wc-acid-2',
        targetQty: 90,
        source: FEED_PLAN_SOURCE.SALES_ORDER,
        sourceRef: 'SO-202611-018',
        splitTo: FEED_PLAN_SPLIT.NONE,
        remark: '销售订单当天补一班面漆。',
        createdAt: '2026-11-19 08:20',
      }),
    )
  }
  return rows
}

function normalizePlanRow(row) {
  if (!row || typeof row !== 'object') return row
  const workCenterId = String(row.workCenterId || '').trim()
  const next = { ...row, workCenterId }
  delete next.productionLineId
  return next
}

function mergeSeedPlans(list) {
  const next = (Array.isArray(list) ? list : []).map(normalizePlanRow)
  seedPlans().forEach((demo) => {
    const sameIdentity = next.some((row) => row.id === demo.id || row.planNo === demo.planNo)
    const sameSlot = next.some(
      (row) =>
        row.formulaId === demo.formulaId &&
        row.periodKey === demo.periodKey &&
        String(row.workCenterId || '') === String(demo.workCenterId || ''),
    )
    if (sameIdentity || sameSlot) return
    if (demo.parentId && !next.some((row) => row.id === demo.parentId)) return
    next.push(demo)
  })
  return next
}

function load() {
  let list = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      list = ensurePlanNumbers(Array.isArray(parsed) ? parsed : []).map(normalizePlanRow)
    }
  } catch {
    list = []
  }
  if (localStorage.getItem(SEED_VERSION_KEY) === CURRENT_SEED_VERSION) return list
  const formulasReady =
    getFormula('formula-paint') && getFormula('formula-alkyd') && getFormula('formula-custom')
  if (!formulasReady) return list
  const merged = mergeSeedPlans(list)
  if (persistJson(STORAGE_KEY, merged)) {
    try {
      localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
    } catch {
      /* 版本写不进时，下次进入还会再补一次 */
    }
  }
  return merged
}

function defaultAutoRelease() {
  return {
    enabled: false,
    /** next_day=只开次日；ahead=今天起共 N 天；from_tomorrow=明天起共 N 天 */
    mode: 'next_day',
    days: 1,
    runAtHour: 0,
    /** 余数不足一个基准批量时，最后一张按基准批量补满 */
    ceilBatch: false,
    lastRunKey: '',
  }
}

function loadAutoRelease() {
  try {
    const raw = localStorage.getItem(AUTO_RELEASE_KEY)
    if (!raw) return defaultAutoRelease()
    return { ...defaultAutoRelease(), ...JSON.parse(raw) }
  } catch {
    return defaultAutoRelease()
  }
}

export const feedPlanState = reactive({
  plans: load(),
  autoRelease: loadAutoRelease(),
})

watch(
  () => feedPlanState.plans,
  () => persistJson(STORAGE_KEY, feedPlanState.plans),
  { deep: true },
)

watch(
  () => feedPlanState.autoRelease,
  () => persistJson(AUTO_RELEASE_KEY, feedPlanState.autoRelease),
  { deep: true },
)

export const FEED_PLAN_BATCH_MODE = {
  ALL: 'all',
  NEXT_DAYS: 'next_days',
  THIS_WEEK: 'this_week',
  DATE_RANGE: 'date_range',
}

export const FEED_PLAN_BATCH_MODE_OPTIONS = [
  { value: FEED_PLAN_BATCH_MODE.NEXT_DAYS, label: '今天起 N 天' },
  { value: FEED_PLAN_BATCH_MODE.THIS_WEEK, label: '本周剩余（含今天）' },
  { value: FEED_PLAN_BATCH_MODE.DATE_RANGE, label: '自定义日期区间' },
  { value: FEED_PLAN_BATCH_MODE.ALL, label: '全部未开启下级' },
]

export const FEED_PLAN_AUTO_MODE = {
  NEXT_DAY: 'next_day',
  AHEAD: 'ahead',
  FROM_TOMORROW: 'from_tomorrow',
}

export const FEED_PLAN_AUTO_MODE_OPTIONS = [
  { value: FEED_PLAN_AUTO_MODE.NEXT_DAY, label: '每晚只开次日' },
  { value: FEED_PLAN_AUTO_MODE.AHEAD, label: '开今天起共 N 天' },
  { value: FEED_PLAN_AUTO_MODE.FROM_TOMORROW, label: '开明天起共 N 天' },
]

export function saveAutoReleaseSettings(partial) {
  Object.assign(feedPlanState.autoRelease, partial || {})
  return feedPlanState.autoRelease
}

/** 主原料：关键料优先；没有关键料时取第一条非辅料。 */
export function mainRawMaterialIds(formula) {
  const lines = formula?.lines || []
  const keys = lines.filter((line) => line.isKeyMaterial && !line.isAuxiliary)
  if (keys.length) return keys.map((line) => line.itemId)
  const first = lines.find((line) => !line.isAuxiliary)
  return first ? [first.itemId] : []
}

export function getFeedPlan(id) {
  return feedPlanState.plans.find((row) => row.id === id) || null
}

export function childPlans(parentId) {
  return feedPlanState.plans.filter((row) => row.parentId === parentId)
}

/** 由挂靠槽次推导，不另手填关闭。日计划不因当天无产出自动关。 */
export const FEED_PLAN_STATUS = {
  OPEN: 'open',
  RUNNING: 'running',
  DONE: 'done',
  STOPPED: 'stopped',
}

export const FEED_PLAN_STATUS_LABEL = {
  [FEED_PLAN_STATUS.OPEN]: '未开启',
  [FEED_PLAN_STATUS.RUNNING]: '执行中',
  [FEED_PLAN_STATUS.DONE]: '已完成',
  [FEED_PLAN_STATUS.STOPPED]: '已终止',
}

export const FEED_PLAN_STATUS_COLOR = {
  [FEED_PLAN_STATUS.OPEN]: 'default',
  [FEED_PLAN_STATUS.RUNNING]: 'processing',
  [FEED_PLAN_STATUS.DONE]: 'success',
  [FEED_PLAN_STATUS.STOPPED]: 'warning',
}

function collectDescendantIds(planId, bag = []) {
  childPlans(planId).forEach((row) => {
    bag.push(row.id)
    collectDescendantIds(row.id, bag)
  })
  return bag
}

/** 本档及下级挂靠批次汇总后的计划状态。已终止的计划直接显示已终止。 */
export function resolveFeedPlanStatus(planId) {
  if (getFeedPlan(planId)?.stopped) return FEED_PLAN_STATUS.STOPPED
  const ids = [planId, ...collectDescendantIds(planId)]
  let hasPending = false
  let hasRunning = false
  let hasDone = false
  let hasCancelled = false
  ids.forEach((id) => {
    listOrdersByFeedPlan(id).forEach((order) => {
      if (order.status === 'pending_release') hasPending = true
      else if (order.status === 'running') hasRunning = true
      else if (order.status === 'done') hasDone = true
      else if (order.status === 'cancelled') hasCancelled = true
    })
  })
  if (hasPending || hasRunning) return FEED_PLAN_STATUS.RUNNING
  if (hasDone) return FEED_PLAN_STATUS.DONE
  if (hasCancelled || getFeedPlan(planId)?.stopped) return FEED_PLAN_STATUS.STOPPED
  return FEED_PLAN_STATUS.OPEN
}

function resolveOwnFeedPlanStatus(planId) {
  let hasPending = false
  let hasRunning = false
  let hasDone = false
  let hasCancelled = false
  listOrdersByFeedPlan(planId).forEach((order) => {
    if (order.status === 'pending_release') hasPending = true
    else if (order.status === 'running') hasRunning = true
    else if (order.status === 'done') hasDone = true
    else if (order.status === 'cancelled') hasCancelled = true
  })
  if (hasPending || hasRunning) return FEED_PLAN_STATUS.RUNNING
  if (hasDone) return FEED_PLAN_STATUS.DONE
  if (hasCancelled || getFeedPlan(planId)?.stopped) return FEED_PLAN_STATUS.STOPPED
  return FEED_PLAN_STATUS.OPEN
}

export function sumActualFeed(plan) {
  if (!plan) return 0
  const formula = getFormula(plan.formulaId)
  const ids = new Set(mainRawMaterialIds(formula))
  if (!ids.size) return 0
  let sum = 0
  for (const order of batchInstructionState.orders || []) {
    if (order.status === 'cancelled') continue
    if (order.formulaId !== plan.formulaId) continue
    for (const feed of order.feeds || []) {
      if (!ids.has(feed.itemId)) continue
      if (!dateInPeriod(feed.at, plan.start, plan.end)) continue
      sum += Number(feed.qty) || 0
    }
  }
  return roundNumber(sum, 3)
}

const SIDE_OUTPUT_ROLES = new Set(['co', 'by'])

/**
 * 联产品、副产品实收。配方里定义了的先占一格，再把挂靠槽次已入库的数量加上。
 * 回收料、废弃物不放进这里。
 */
export function listSideOutputQtys(plan) {
  if (!plan) return []
  const formula = getFormula(plan.formulaId)
  const bag = new Map()
  const ensure = (itemId, role) => {
    const key = `${role}:${itemId}`
    if (!bag.has(key)) bag.set(key, { itemId, role, qty: 0 })
    return bag.get(key)
  }
  for (const line of formula?.outputs || []) {
    if (!SIDE_OUTPUT_ROLES.has(line.role) || !line.itemId) continue
    ensure(line.itemId, line.role)
  }
  for (const order of planLinkedOrders(plan)) {
    for (const row of order.outputs || []) {
      const role = row.role || ''
      if (!SIDE_OUTPUT_ROLES.has(role) || !row.itemId) continue
      const slot = ensure(row.itemId, role)
      slot.qty = roundNumber(slot.qty + (Number(row.qty) || 0), 3)
    }
  }
  const roleOrder = { co: 0, by: 1 }
  return [...bag.values()].sort(
    (a, b) =>
      roleOrder[a.role] - roleOrder[b.role] || String(a.itemId).localeCompare(String(b.itemId)),
  )
}

/** 主产出实收：优先按挂靠计划树，否则按同配方且期间内有投料的槽次。 */
export function sumActualOutput(plan) {
  if (!plan) return 0
  const planIds = new Set([plan.id, ...collectDescendantIds(plan.id)])
  let sum = 0
  for (const order of batchInstructionState.orders || []) {
    if (order.status === 'cancelled') continue
    let hit = false
    if (order.feedPlanId) {
      hit = planIds.has(order.feedPlanId)
    } else if (order.formulaId === plan.formulaId) {
      hit = (order.feeds || []).some((feed) => dateInPeriod(feed.at, plan.start, plan.end))
    }
    if (!hit) continue
    sum += Number(order.actualOutput) || 0
  }
  return roundNumber(sum, 3)
}

/** 投入产出比 = 主产出实收 / 主原料实投。缺数返回 null。 */
export function feedOutputRatio(plan) {
  const input = sumActualFeed(plan)
  const output = sumActualOutput(plan)
  if (!(input > 0) || !(output >= 0)) return null
  if (!(output > 0)) return null
  return roundNumber(output / input, 4)
}

function contentAsFraction(value) {
  const n = Number(value)
  if (!(n > 0)) return null
  return n > 1 ? n / 100 : n
}

function planLinkedOrders(plan) {
  if (!plan) return []
  const planIds = new Set([plan.id, ...collectDescendantIds(plan.id)])
  return (batchInstructionState.orders || []).filter((order) => {
    if (order.status === 'cancelled') return false
    if (order.feedPlanId) return planIds.has(order.feedPlanId)
    if (order.formulaId !== plan.formulaId) return false
    return (order.feeds || []).some((feed) => dateInPeriod(feed.at, plan.start, plan.end))
  })
}

/** 辅料实投（配方辅料，或非主原料行）。 */
export function sumAuxFeed(plan) {
  if (!plan) return 0
  const formula = getFormula(plan.formulaId)
  const mainIds = new Set(mainRawMaterialIds(formula))
  let sum = 0
  for (const order of planLinkedOrders(plan)) {
    for (const feed of order.feeds || []) {
      const line = (formula?.lines || []).find((row) => row.itemId === feed.itemId)
      const isAux = Boolean(line?.isAuxiliary) || (mainIds.size > 0 && !mainIds.has(feed.itemId))
      if (!isAux) continue
      sum += Number(feed.qty) || 0
    }
  }
  return roundNumber(sum, 3)
}

/** 主元素投入量 ≈ Σ(实投 × 含量)。含量缺则跳过该行。 */
export function sumMetalInput(plan) {
  if (!plan) return 0
  const formula = getFormula(plan.formulaId)
  const mainIds = new Set(mainRawMaterialIds(formula))
  if (!mainIds.size) return 0
  let sum = 0
  let any = false
  for (const order of planLinkedOrders(plan)) {
    for (const feed of order.feeds || []) {
      if (!mainIds.has(feed.itemId)) continue
      const frac = contentAsFraction(feed.contentUsed)
      if (frac == null) continue
      any = true
      sum += (Number(feed.qty) || 0) * frac
    }
  }
  return any ? roundNumber(sum, 3) : null
}

/** 主元素产出量 ≈ Σ(主产出 × 产出批次含量)。 */
export function sumMetalOutput(plan) {
  if (!plan) return 0
  let sum = 0
  let any = false
  for (const order of planLinkedOrders(plan)) {
    for (const row of order.outputs || []) {
      if (row.role && row.role !== 'main') continue
      const batch = row.batchId ? getMaterialBatch(row.batchId) : null
      const frac = contentAsFraction(batch?.content)
      if (frac == null) continue
      any = true
      sum += (Number(row.qty) || 0) * frac
    }
  }
  return any ? roundNumber(sum, 3) : null
}

/** 主元素收率 = 金属产出 / 金属投入。 */
export function metalRecoveryRate(plan) {
  const input = sumMetalInput(plan)
  const output = sumMetalOutput(plan)
  if (!(input > 0) || output == null || !(output >= 0)) return null
  return roundNumber(output / input, 4)
}

/**
 * 计划详情可统计的过程指标。缺数返回 null，页面显示 —。
 * 能耗单耗 / 故障停时：来自班次交班填报，按计划期间汇总，不拆槽次。
 * 优级品率：一期仍无产出等级汇总。
 */
export function buildFeedPlanKpis(plan) {
  if (!plan) return null
  const orders = planLinkedOrders(plan)
  const feedQty = sumActualFeed(plan)
  const outputQty = sumActualOutput(plan)
  const auxQty = sumAuxFeed(plan)
  const target = Number(plan.targetQty) || 0
  const completeRate = target > 0 ? roundNumber(feedQty / target, 4) : null
  const ioRatio = feedOutputRatio(plan)
  const auxUnitConsume = outputQty > 0 && auxQty >= 0 ? roundNumber(auxQty / outputQty, 4) : null
  const recovery = metalRecoveryRate(plan)

  const doneOrders = orders.filter((row) => row.status === 'done')
  const runningCount = orders.filter((row) => row.status === 'running').length
  const pendingCount = orders.filter((row) => row.status === 'pending_release').length
  const doneCount = doneOrders.length

  const gaps = doneOrders.map((row) => Number(row.yieldGap)).filter((n) => Number.isFinite(n))
  const avgYieldGap = gaps.length
    ? roundNumber(gaps.reduce((a, b) => a + b, 0) / gaps.length, 3)
    : null

  const cycles = doneOrders
    .map((row) => {
      const start = dayjs(row.createdAt || row.planStart)
      const end = dayjs(row.completedAt)
      if (!start.isValid() || !end.isValid()) return null
      const hours = end.diff(start, 'hour', true)
      return hours >= 0 ? hours : null
    })
    .filter((n) => n != null)
  const avgCycleHours = cycles.length
    ? roundNumber(cycles.reduce((a, b) => a + b, 0) / cycles.length, 1)
    : null

  const shiftSum = sumShiftReportsInRange(plan.start, plan.end)
  const energyUnitConsume =
    shiftSum.reportCount > 0 && feedQty > 0
      ? roundNumber(shiftSum.electricityKwh / feedQty, 4)
      : null
  const downtimeHours = shiftSum.reportCount > 0 ? shiftSum.downtimeHours : null
  const electricityKwh = shiftSum.reportCount > 0 ? shiftSum.electricityKwh : null

  return {
    childCount: childPlans(plan.id).length,
    runningCount,
    pendingCount,
    doneCount,
    feedQty,
    targetQty: target,
    outputQty,
    sideOutputs: listSideOutputQtys(plan),
    auxQty,
    completeRate,
    ioRatio,
    auxUnitConsume,
    recovery,
    avgYieldGap,
    avgCycleHours,
    wipOrderCount: runningCount,
    energyUnitConsume,
    electricityKwh,
    downtimeHours,
    shiftReportCount: shiftSum.reportCount,
  }
}

function assertParent(plan, parentId) {
  if (!parentId) return null
  const parent = getFeedPlan(parentId)
  if (!parent) throw new Error('上级计划不存在')
  if (parent.formulaId !== plan.formulaId) throw new Error('上级计划须是同一张配方')
  if (String(parent.workCenterId || '') !== String(plan.workCenterId || '')) {
    throw new Error('上级计划须是同一工作中心')
  }
  if (parent.periodType !== parentPeriodType(plan.periodType)) {
    throw new Error(
      plan.periodType === FEED_PLAN_PERIOD.WEEK ? '周计划只能挂月计划' : '日计划只能挂周计划',
    )
  }
  if (!periodCovers(parent, plan)) throw new Error('上级计划的期间盖不住这一档')
  return parent
}

function newPlanId() {
  return `fp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function saveFeedPlan(payload, id) {
  if (id && resolveFeedPlanStatus(id) !== FEED_PLAN_STATUS.OPEN) {
    throw new Error('只有未开启的计划可以编辑')
  }
  const period = buildFeedPlanPeriod(payload.periodType, payload.date, payload.range)
  if (!period) throw new Error('请选择期间')
  const formula = getFormula(payload.formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择生效配方')
  const targetQty = Number(payload.targetQty)
  if (!(targetQty > 0)) throw new Error('目标投料量须大于 0')
  const workCenterId = String(payload.workCenterId || '').trim()
  const duplicated = feedPlanState.plans.find(
    (row) =>
      row.id !== id &&
      row.formulaId === formula.id &&
      row.periodKey === period.periodKey &&
      String(row.workCenterId || '') === workCenterId,
  )
  if (duplicated) {
    throw new Error(
      workCenterId
        ? '这张配方在该工作中心、该期间已经有计划'
        : '这张配方在该期间已经有未指定工作中心的计划',
    )
  }
  const source = payload.source || FEED_PLAN_SOURCE.MPS
  if (!Object.values(FEED_PLAN_SOURCE).includes(source)) {
    throw new Error('请选择计划来源')
  }
  const draft = {
    periodType: payload.periodType,
    ...period,
    formulaId: formula.id,
    itemId: formula.itemId,
    workCenterId,
    targetQty: roundNumber(targetQty, 3),
    parentId: payload.parentId || '',
    source,
    sourceRef: String(payload.sourceRef || '').trim(),
    splitTo: payload.splitTo || FEED_PLAN_SPLIT.NONE,
    remark: String(payload.remark || '').trim(),
    planName:
      String(payload.planName || '').trim() ||
      defaultPlanName(payload.periodType, payload.date, payload.range),
    theoreticalYield: Number(formula.theoreticalYield),
    theoreticalOutput: theoreticalOutput(targetQty, formula.theoreticalYield),
  }
  assertParent(draft, draft.parentId)

  const customNo = String(payload.planNo || '').trim()
  if (customNo) {
    const clash = feedPlanState.plans.find((row) => row.id !== id && row.planNo === customNo)
    if (clash) throw new Error('计划编号已存在')
  }

  let row
  if (!id) {
    const parent = draft.parentId ? getFeedPlan(draft.parentId) : null
    let planNo
    let rootPlanNo
    if (customNo) {
      planNo = customNo
      rootPlanNo = parent?.rootPlanNo || customNo
    } else if (parent?.planNo) {
      const siblings = childPlans(parent.id)
      planNo = childPlanNo(parent.planNo, siblings.length + 1)
      rootPlanNo = parent.rootPlanNo || parent.planNo
    } else {
      planNo = nextRootPlanNo()
      rootPlanNo = planNo
    }
    row = {
      id: newPlanId(),
      ...draft,
      planNo,
      rootPlanNo,
      createdBy: currentOperator(),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      executedAt: '',
      executedBy: '',
    }
    appendOperationLog(row, '新增计划')
    feedPlanState.plans.unshift(row)
  } else {
    row = getFeedPlan(id)
    if (!row) throw new Error('计划不存在')
    Object.assign(row, draft)
    if (customNo) {
      row.planNo = customNo
      if (!row.parentId) row.rootPlanNo = customNo
    }
    appendOperationLog(row, '编辑计划')
  }

  const splitTo = draft.splitTo
  if (!id && splitTo && splitTo !== FEED_PLAN_SPLIT.NONE) {
    // 新增时勾选的「跳过休息日」仅对拆日生效
    splitFeedPlan(row.id, splitTo, {
      replace: true,
      skipRestDays: payload.skipRestDays !== false,
    })
  }
  return row
}

/**
 * 把月/周计划拆成下级草稿。下级目标均分，拆完可改。
 * 已有下级时默认拒绝；replace=true 时先清未挂指令的下级。
 * @param {{ replace?: boolean, skipRestDays?: boolean }} [options]
 *   skipRestDays：拆日时是否跳过周末；默认 true（与表单勾选默认一致）
 */
export function splitFeedPlan(planId, splitTo, { replace = false, skipRestDays = true } = {}) {
  const parent = getFeedPlan(planId)
  if (!parent) throw new Error('计划不存在')
  if (splitTo !== FEED_PLAN_SPLIT.WEEK && splitTo !== FEED_PLAN_SPLIT.DAY) {
    throw new Error('请选择拆到周或拆到日')
  }
  if (parent.periodType === FEED_PLAN_PERIOD.DAY) throw new Error('日计划不能再拆')
  if (parent.periodType === FEED_PLAN_PERIOD.CUSTOM) throw new Error('自定义期间不能再拆')
  if (resolveFeedPlanStatus(planId) !== FEED_PLAN_STATUS.OPEN) {
    throw new Error('只有未开启的计划可以拆分')
  }
  if (parent.periodType === FEED_PLAN_PERIOD.WEEK && splitTo === FEED_PLAN_SPLIT.WEEK) {
    throw new Error('周计划只能拆到日')
  }

  const childType = splitTargetPeriodType(splitTo)
  const existing = childPlans(planId)
  if (existing.length) {
    if (!replace) throw new Error('已有下级计划，请先删下级或确认覆盖')
    for (const child of existing) {
      const nested = childPlans(child.id)
      if (nested.length) throw new Error(`下级「${child.periodLabel}」还有更下级，请先删掉再拆`)
      const linked = listOrdersByFeedPlan(child.id).filter((o) => o.status !== 'cancelled')
      if (linked.length) {
        throw new Error(`下级「${child.periodLabel}」已挂槽次，不能覆盖拆分`)
      }
      const removed = deleteFeedPlan(child.id)
      if (!removed.ok) throw new Error(removed.message || '清理下级失败')
    }
  }

  // 仅拆日时尊重勾选；拆周不涉及休息日
  const applySkipRest = splitTo === FEED_PLAN_SPLIT.DAY && skipRestDays !== false
  const periods = listChildPeriods(parent, splitTo, { skipRestDays: applySkipRest })
  if (!periods.length) {
    throw new Error(applySkipRest ? '该期间没有工作日可拆（休息日已过滤）' : '该期间拆不出下级')
  }
  if (!parent.planNo) {
    parent.planNo = nextRootPlanNo(dayjs(parent.createdAt || parent.start || undefined))
    parent.rootPlanNo = parent.planNo
  }
  const qtys = distributeTargetQty(parent.targetQty, periods.length)
  const created = []
  periods.forEach((period, index) => {
    const dup = feedPlanState.plans.find(
      (row) =>
        row.formulaId === parent.formulaId &&
        row.periodKey === period.periodKey &&
        String(row.workCenterId || '') === String(parent.workCenterId || ''),
    )
    if (dup) return
    const row = {
      id: newPlanId(),
      periodType: childType,
      ...period,
      formulaId: parent.formulaId,
      itemId: parent.itemId,
      workCenterId: parent.workCenterId || '',
      targetQty: qtys[index],
      parentId: parent.id,
      source: parent.source || FEED_PLAN_SOURCE.MPS,
      sourceRef: parent.sourceRef || '',
      splitTo: FEED_PLAN_SPLIT.NONE,
      remark: '',
      planName: defaultPlanName(childType, period.start),
      theoreticalYield: Number(getFormula(parent.formulaId)?.theoreticalYield),
      theoreticalOutput: theoreticalOutput(
        qtys[index],
        getFormula(parent.formulaId)?.theoreticalYield,
      ),
      planNo: childPlanNo(parent.planNo, index + 1),
      rootPlanNo: parent.rootPlanNo || parent.planNo,
      createdBy: currentOperator(),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
      executedAt: '',
      executedBy: '',
    }
    appendOperationLog(row, '新增计划', '从上级拆出')
    feedPlanState.plans.push(row)
    created.push(row)
  })
  parent.splitTo = splitTo
  appendOperationLog(parent, '拆分子计划', `${created.length} 条`)
  return created
}

/**
 * 未开启叶子计划的预计开启时间（按当前自动下发规则反推首次落入窗口的跑批日）。
 * 未启用自动下发时返回空。
 */
export function estimateExpectedExecuteAt(plan, settings = feedPlanState.autoRelease) {
  if (!plan) return ''
  if (plan.executedAt) return plan.executedAt
  if (!settings?.enabled) return ''
  if (childPlans(plan.id).length) return ''
  const start = dayjs(plan.start)
  if (!start.isValid()) return ''
  const hour = Math.min(23, Math.max(0, Number(settings.runAtHour) || 0))
  const days = Math.max(1, Number(settings.days) || 1)
  let runDay
  if (settings.mode === FEED_PLAN_AUTO_MODE.NEXT_DAY) {
    runDay = start.subtract(1, 'day')
  } else if (settings.mode === FEED_PLAN_AUTO_MODE.FROM_TOMORROW) {
    runDay = start.subtract(days, 'day')
  } else {
    runDay = start.subtract(days - 1, 'day')
  }
  return runDay.hour(hour).minute(0).second(0).format('YYYY-MM-DD HH:mm')
}

function planSourceLabel(plan) {
  const typeLabel = FEED_PLAN_PERIOD_LABEL[plan.periodType] || '计划'
  return `${typeLabel} ${plan.periodLabel}`
}

function markPlanExecuted(plan) {
  if (!plan) return
  if (!plan.executedAt) {
    plan.executedAt = dayjs().format('YYYY-MM-DD HH:mm')
    plan.executedBy = currentOperator()
  }
}

export function hasActiveTankCharge(planId) {
  return listOrdersByFeedPlan(planId).some(
    (row) => row.status === 'pending_release' || row.status === 'running' || row.status === 'done',
  )
}

export function planFeedCoverage(planId) {
  const plan = getFeedPlan(planId)
  const formula = plan ? getFormula(plan.formulaId) : null
  const linkedQty = round3(
    listOrdersByFeedPlan(planId)
      .filter((row) => row.status !== 'cancelled')
      .reduce((sum, row) => sum + (Number(row.qty) || 0), 0),
  )
  const target = round3(plan?.targetQty || 0)
  return {
    target,
    linkedQty,
    remaining: round3(Math.max(0, target - linkedQty)),
    base: Number(formula?.baseBatchQty) || 0,
  }
}

/** 在本档计划上按计划投料量生成批次指令。未传数量时按剩余目标和基准批量拆分。 */
export function executeFeedPlan(
  planId,
  { qtys, ceil = false, actor, workCenterId, batchNos, remark } = {},
) {
  const plan = getFeedPlan(planId)
  if (!plan) throw new Error('计划不存在')
  if (plan.stopped || resolveFeedPlanStatus(planId) === FEED_PLAN_STATUS.STOPPED) {
    throw new Error('该计划已终止，不能再生成批次指令')
  }
  if (resolveFeedPlanStatus(planId) === FEED_PLAN_STATUS.DONE) {
    throw new Error('已完成的计划不能再生成批次指令')
  }
  if (childPlans(planId).length) {
    throw new Error('已拆下级，请到周/日计划上生成，或使用批量生成')
  }
  const formula = getFormula(plan.formulaId)
  if (!formula || formula.status !== 'active') throw new Error('请选择生效配方')
  const coverage = planFeedCoverage(planId)
  const rows = Array.isArray(qtys)
    ? qtys.map((qty) => round3(qty)).filter((qty) => qty > 0)
    : splitPlanFeedQty(coverage.remaining, formula.baseBatchQty, { ceil }).map((row) => row.qty)
  if (!rows.length) throw new Error('剩余目标投料量已用完')
  const who = actor || currentOperator()
  const lockedWorkCenterId = String(plan.workCenterId || '').trim()
  const centerId = lockedWorkCenterId
    ? lockedWorkCenterId
    : workCenterId === undefined
      ? ''
      : String(workCenterId || '').trim()
  const remarkText = String(remark || '').trim()
  const created = rows.map((qty, index) =>
    createTankChargeFromPlan({
      formulaId: plan.formulaId,
      feedPlanId: plan.id,
      workCenterId: centerId,
      sourceLabel: planSourceLabel(plan),
      planStart: plan.start,
      planEnd: plan.end,
      plannedQty: qty,
      seq: index + 1,
      batchCount: rows.length,
      createdBy: who,
      batchNo: Array.isArray(batchNos) ? batchNos[index] : '',
      remark: remarkText,
    }),
  )
  markPlanExecuted(plan)
  appendOperationLog(plan, '生成批次指令', `${created.length} 张`, who)
  return created
}

function deepestLeaves(planId) {
  const kids = childPlans(planId)
  if (!kids.length) return []
  return kids.flatMap((row) => {
    const nested = deepestLeaves(row.id)
    return nested.length ? nested : [row]
  })
}

function resolveBatchWindow(mode, { days = 7, startDate, endDate } = {}) {
  const today = dayjs().startOf('day')
  if (mode === FEED_PLAN_BATCH_MODE.ALL) return null
  if (mode === FEED_PLAN_BATCH_MODE.NEXT_DAYS) {
    const n = Math.max(1, Number(days) || 1)
    return {
      start: today.format('YYYY-MM-DD'),
      end: today.add(n - 1, 'day').format('YYYY-MM-DD'),
    }
  }
  if (mode === FEED_PLAN_BATCH_MODE.THIS_WEEK) {
    return {
      start: today.format('YYYY-MM-DD'),
      end: today.endOf('isoWeek').format('YYYY-MM-DD'),
    }
  }
  if (mode === FEED_PLAN_BATCH_MODE.DATE_RANGE) {
    const start = dayjs(startDate)
    const end = dayjs(endDate)
    if (!start.isValid() || !end.isValid()) throw new Error('请选择日期区间')
    if (end.isBefore(start, 'day')) throw new Error('结束日期不能早于开始日期')
    return {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    }
  }
  throw new Error('请选择开启方式')
}

function leafInWindow(leaf, window) {
  if (!window) return true
  return leaf.start <= window.end && leaf.end >= window.start
}

/** 按规则给下级叶子生成指令：用每张叶子的剩余目标，按基准批量拆开。 */
export function executeChildFeedPlans(planId, options = {}) {
  const mode = options.mode || FEED_PLAN_BATCH_MODE.ALL
  const window = resolveBatchWindow(mode, options)
  const leaves = deepestLeaves(planId).filter(
    (row) => leafInWindow(row, window) && !row.stopped && planFeedCoverage(row.id).remaining > 0,
  )
  if (!leaves.length) throw new Error('所选范围内没有剩余目标投料量')
  return leaves.flatMap((row) => executeFeedPlan(row.id))
}

function resolveAutoWindow(settings, now = dayjs()) {
  const base = now.startOf('day')
  const days = Math.max(1, Number(settings.days) || 1)
  if (settings.mode === FEED_PLAN_AUTO_MODE.NEXT_DAY) {
    const d = base.add(1, 'day')
    return { start: d.format('YYYY-MM-DD'), end: d.format('YYYY-MM-DD') }
  }
  if (settings.mode === FEED_PLAN_AUTO_MODE.FROM_TOMORROW) {
    const start = base.add(1, 'day')
    return {
      start: start.format('YYYY-MM-DD'),
      end: start.add(days - 1, 'day').format('YYYY-MM-DD'),
    }
  }
  return {
    start: base.format('YYYY-MM-DD'),
    end: base.add(days - 1, 'day').format('YYYY-MM-DD'),
  }
}

/**
 * 自动下发：扫描全部日/周叶子，按窗口补开未开启计划。
 * 浏览器端无法保证整点后台任务；进入页面或定时轮询时补跑。
 */
export function runAutoReleaseFeedPlans({ force = false, now = dayjs() } = {}) {
  const settings = feedPlanState.autoRelease
  if (!settings.enabled && !force) return { ok: false, skipped: true, created: [] }
  const hour = now.hour()
  const runKey = now.format('YYYY-MM-DD')
  if (!force) {
    if (hour < Number(settings.runAtHour || 0)) {
      return { ok: false, skipped: true, reason: '未到执行时刻', created: [] }
    }
    if (settings.lastRunKey === runKey) {
      return { ok: false, skipped: true, reason: '今日已跑过', created: [] }
    }
  }
  const window = resolveAutoWindow(settings, now)
  const leaves = feedPlanState.plans.filter((row) => {
    if (childPlans(row.id).length) return false
    if (row.stopped) return false
    if (hasActiveTankCharge(row.id)) return false
    return leafInWindow(row, window)
  })
  const created = []
  leaves.forEach((row) => {
    created.push(
      ...executeFeedPlan(row.id, { ceil: Boolean(settings.ceilBatch), actor: AUTO_ACTOR }),
    )
  })
  settings.lastRunKey = runKey
  return { ok: true, window, created }
}

/** 终止本计划及未完成的下级。只作废待下发批次，执行中和已完成的批次不动。 */
export function stopFeedPlanOrders(planId) {
  const ids = [planId, ...collectDescendantIds(planId)]
  let count = 0
  ids.forEach((id) => {
    listOrdersByFeedPlan(id)
      .filter((row) => row.status === 'pending_release')
      .forEach((row) => {
        cancelBatchOrder(row.id)
        count += 1
      })
  })
  ids.forEach((id) => {
    const plan = getFeedPlan(id)
    if (!plan) return
    if (resolveOwnFeedPlanStatus(id) === FEED_PLAN_STATUS.DONE) return
    plan.stopped = true
    appendOperationLog(plan, '终止计划', id === planId && count ? `作废待下发批次 ${count} 张` : '')
  })
  return count
}

/** 没有下级、且还有剩余目标投料量时，才能再生成批次指令。 */
export function canGenerateFeedPlan(planId) {
  const plan = getFeedPlan(planId)
  if (!plan || plan.stopped) return false
  if (childPlans(planId).length) return false
  const status = resolveFeedPlanStatus(planId)
  if (status !== FEED_PLAN_STATUS.OPEN && status !== FEED_PLAN_STATUS.RUNNING) return false
  return planFeedCoverage(planId).remaining > 0
}

/** 生成批次指令弹窗：可选的生产计划下拉。 */
export function listGeneratableFeedPlanOptions() {
  return feedPlanState.plans
    .filter((row) => canGenerateFeedPlan(row.id))
    .slice()
    .sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')))
    .map((row) => {
      const typeLabel = FEED_PLAN_PERIOD_LABEL[row.periodType] || '计划'
      const coverage = planFeedCoverage(row.id)
      const name = row.planName || `${typeLabel} ${row.periodLabel || ''}`.trim()
      return {
        value: row.id,
        label: `${row.planNo || row.id} ${name} · 剩余 ${coverage.remaining} kg`,
        plan: row,
      }
    })
}

export function deleteFeedPlan(id) {
  const index = feedPlanState.plans.findIndex((row) => row.id === id)
  if (index < 0) return { ok: false, message: '计划不存在' }
  const linked = listOrdersByFeedPlan(id).filter((o) => o.status !== 'cancelled')
  if (linked.length) {
    return { ok: false, message: '还有未作废的槽次，请先作废再删计划' }
  }
  const children = childPlans(id)
  if (children.length) {
    return { ok: false, message: '请先删除下级计划' }
  }
  feedPlanState.plans.splice(index, 1)
  return { ok: true }
}
