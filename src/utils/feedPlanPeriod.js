import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'

dayjs.extend(isoWeek)

export const FEED_PLAN_PERIOD = {
  MONTH: 'month',
  WEEK: 'week',
  DAY: 'day',
  CUSTOM: 'custom',
}

export const FEED_PLAN_PERIOD_OPTIONS = [
  { value: FEED_PLAN_PERIOD.MONTH, label: '月' },
  { value: FEED_PLAN_PERIOD.WEEK, label: '周' },
  { value: FEED_PLAN_PERIOD.DAY, label: '日' },
  { value: FEED_PLAN_PERIOD.CUSTOM, label: '自定义' },
]

export const FEED_PLAN_PERIOD_LABEL = {
  [FEED_PLAN_PERIOD.MONTH]: '月计划',
  [FEED_PLAN_PERIOD.WEEK]: '周计划',
  [FEED_PLAN_PERIOD.DAY]: '日计划',
  [FEED_PLAN_PERIOD.CUSTOM]: '自定义计划',
}

/** 默认计划名称：期间 + 期间类型 +「计划」，如「2026年11月月计划」。 */
export function defaultPlanName(periodType, date, range) {
  const period = buildFeedPlanPeriod(periodType, date, range)
  if (!period) return ''
  const typeText = FEED_PLAN_PERIOD_OPTIONS.find((row) => row.value === periodType)?.label || ''
  return `${period.periodLabel}${typeText}计划`
}

/** 计划来源：流程型常见触发，一张计划一个主来源。 */
export const FEED_PLAN_SOURCE = {
  SALES_ORDER: 'sales_order',
  MPS: 'mps',
  REPLENISH: 'replenish',
  MATERIAL: 'material',
  CAMPAIGN: 'campaign',
  TRIAL: 'trial',
  REWORK: 'rework',
  MANUAL: 'manual',
}

export const FEED_PLAN_SOURCE_OPTIONS = [
  { value: FEED_PLAN_SOURCE.MPS, label: '预测/主计划' },
  { value: FEED_PLAN_SOURCE.SALES_ORDER, label: '销售订单' },
  { value: FEED_PLAN_SOURCE.REPLENISH, label: '库存补货' },
  { value: FEED_PLAN_SOURCE.MATERIAL, label: '原料驱动' },
  { value: FEED_PLAN_SOURCE.CAMPAIGN, label: '战役排产' },
  { value: FEED_PLAN_SOURCE.TRIAL, label: '试产/试样' },
  { value: FEED_PLAN_SOURCE.REWORK, label: '返工' },
  { value: FEED_PLAN_SOURCE.MANUAL, label: '手工' },
]

export const FEED_PLAN_SOURCE_LABEL = Object.fromEntries(
  FEED_PLAN_SOURCE_OPTIONS.map((row) => [row.value, row.label]),
)

/** 周计划挂月计划，日计划挂周计划。不强制必须有上级。 */
export function parentPeriodType(periodType) {
  if (periodType === FEED_PLAN_PERIOD.WEEK) return FEED_PLAN_PERIOD.MONTH
  if (periodType === FEED_PLAN_PERIOD.DAY) return FEED_PLAN_PERIOD.WEEK
  return ''
}

export function buildFeedPlanPeriod(periodType, date, range) {
  if (periodType === FEED_PLAN_PERIOD.CUSTOM) {
    const start = dayjs(range?.[0])
    const end = dayjs(range?.[1])
    if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return null
    const startKey = start.format('YYYY-MM-DD')
    const endKey = end.format('YYYY-MM-DD')
    return {
      periodKey: `custom:${startKey}~${endKey}`,
      periodLabel: startKey === endKey ? startKey : `${startKey}~${endKey}`,
      start: startKey,
      end: endKey,
    }
  }
  const d = dayjs(date)
  if (!periodType || !d.isValid()) return null
  if (periodType === FEED_PLAN_PERIOD.MONTH) {
    const start = d.startOf('month')
    const end = d.endOf('month')
    return {
      periodKey: start.format('YYYY-MM'),
      periodLabel: start.format('YYYY年M月'),
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    }
  }
  if (periodType === FEED_PLAN_PERIOD.WEEK) {
    const start = d.startOf('isoWeek')
    const end = d.endOf('isoWeek')
    const periodKey = `${start.isoWeekYear()}-W${String(start.isoWeek()).padStart(2, '0')}`
    return {
      periodKey,
      periodLabel: `${periodKey}（${start.format('MM-DD')}~${end.format('MM-DD')}）`,
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
    }
  }
  if (periodType === FEED_PLAN_PERIOD.DAY) {
    const key = d.format('YYYY-MM-DD')
    return {
      periodKey: key,
      periodLabel: key,
      start: key,
      end: key,
    }
  }
  return null
}

export function periodCovers(parent, child) {
  if (!parent?.start || !parent?.end || !child?.start || !child?.end) return false
  return parent.start <= child.start && parent.end >= child.end
}

export function dateInPeriod(at, start, end) {
  const day = dayjs(at)
  if (!day.isValid() || !start || !end) return false
  const key = day.format('YYYY-MM-DD')
  return key >= start && key <= end
}

/** 建月/周计划时可选：不拆 / 拆到周 / 拆到日。 */
export const FEED_PLAN_SPLIT = {
  NONE: 'none',
  WEEK: 'week',
  DAY: 'day',
}

export const FEED_PLAN_SPLIT_OPTIONS = [
  { value: FEED_PLAN_SPLIT.NONE, label: '不拆分' },
  { value: FEED_PLAN_SPLIT.WEEK, label: '拆成周计划' },
  { value: FEED_PLAN_SPLIT.DAY, label: '拆成日计划' },
]

export const FEED_PLAN_SPLIT_LABEL = {
  [FEED_PLAN_SPLIT.NONE]: '不拆分',
  [FEED_PLAN_SPLIT.WEEK]: '拆成周计划',
  [FEED_PLAN_SPLIT.DAY]: '拆成日计划',
}

/** 把目标量均分到 N 档，尾差落在最后一档，合计仍等于总额。 */
export function distributeTargetQty(total, count) {
  const n = Math.max(0, Number(count) || 0)
  const sum = Number(total) || 0
  if (!n) return []
  if (!(sum > 0)) return Array.from({ length: n }, () => 0)
  const base = Math.floor((sum / n) * 1000) / 1000
  const rows = Array.from({ length: n }, () => base)
  const used = Math.round(base * n * 1000) / 1000
  rows[n - 1] = Math.round((sum - used + base) * 1000) / 1000
  return rows
}

/**
 * 一期休息日：周六、周日。
 * 后续可接工厂日历 / 法定假；未接前拆日只认周末。
 */
export function isRestDay(date) {
  const d = dayjs(date)
  if (!d.isValid()) return false
  const weekday = d.day() // 0=周日 … 6=周六
  return weekday === 0 || weekday === 6
}

/**
 * 在 parent.start~parent.end 内枚举下级期间。
 * 拆到周：覆盖到的 ISO 周；拆到日：日历日（可选跳过休息日）。
 * @param {{ skipRestDays?: boolean }} [options] skipRestDays 默认 true：拆日时跳过周末
 */
export function listChildPeriods(parent, splitTo, options = {}) {
  if (!parent?.start || !parent?.end) return []
  const start = dayjs(parent.start)
  const end = dayjs(parent.end)
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return []
  const skipRestDays = options.skipRestDays !== false

  if (splitTo === FEED_PLAN_SPLIT.WEEK) {
    const keys = new Set()
    const rows = []
    let cursor = start.startOf('isoWeek')
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      const period = buildFeedPlanPeriod(FEED_PLAN_PERIOD.WEEK, cursor)
      if (period && !keys.has(period.periodKey)) {
        // 周与父期间相交才保留
        if (period.start <= parent.end && period.end >= parent.start) {
          keys.add(period.periodKey)
          rows.push(period)
        }
      }
      cursor = cursor.add(1, 'week')
    }
    return rows
  }

  if (splitTo === FEED_PLAN_SPLIT.DAY) {
    const rows = []
    let cursor = start.startOf('day')
    while (cursor.isBefore(end) || cursor.isSame(end, 'day')) {
      // 休息日不生成日计划；目标量只均分到留下的工作日
      if (!(skipRestDays && isRestDay(cursor))) {
        const period = buildFeedPlanPeriod(FEED_PLAN_PERIOD.DAY, cursor)
        if (period) rows.push(period)
      }
      cursor = cursor.add(1, 'day')
    }
    return rows
  }

  return []
}

export function splitTargetPeriodType(splitTo) {
  if (splitTo === FEED_PLAN_SPLIT.WEEK) return FEED_PLAN_PERIOD.WEEK
  if (splitTo === FEED_PLAN_SPLIT.DAY) return FEED_PLAN_PERIOD.DAY
  return ''
}
