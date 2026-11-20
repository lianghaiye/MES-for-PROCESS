import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { persistJson } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'
import { roundNumber } from '@/utils/numberFormat'

/** 与手机端同源 key，H5 同域可互通。 */
export const SHIFT_ENERGY_REPORT_STORAGE_KEY = 'i_doms_shift_energy_reports'

export const SHIFT_OPTIONS = [
  { value: 'day', label: '白班' },
  { value: 'night', label: '夜班' },
]

export const SHIFT_LABEL = Object.fromEntries(SHIFT_OPTIONS.map((row) => [row.value, row.label]))

/** 一期按车间/工段记，不挂槽次。 */
export const WORKSHOP_OPTIONS = [
  { value: 'acid_leach', label: '酸浸车间' },
  { value: 'water_leach', label: '水浸车间' },
  { value: 'evaporation', label: '蒸发浓缩' },
  { value: 'precip', label: '除杂沉锂' },
  { value: 'packaging', label: '成品包装' },
]

export const WORKSHOP_LABEL = Object.fromEntries(
  WORKSHOP_OPTIONS.map((row) => [row.value, row.label]),
)

function currentOperator() {
  const user = getUser()
  return String(user?.displayName || user?.username || user?.name || 'admin')
}

function load() {
  try {
    const raw = localStorage.getItem(SHIFT_ENERGY_REPORT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const shiftEnergyReportState = reactive({
  reports: load(),
})

watch(
  () => shiftEnergyReportState.reports,
  (list) => persistJson(SHIFT_ENERGY_REPORT_STORAGE_KEY, list),
  { deep: true },
)

function newId() {
  return `ser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function normalizeNum(val) {
  if (val === '' || val == null) return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function assertPayload(payload) {
  const date = String(payload.date || '').trim()
  if (!dayjs(date).isValid()) throw new Error('请选择日期')
  const shift = payload.shift
  if (!SHIFT_LABEL[shift]) throw new Error('请选择班次')
  const workshop = payload.workshop
  if (!WORKSHOP_LABEL[workshop]) throw new Error('请选择车间')

  const electricityKwh = normalizeNum(payload.electricityKwh)
  const steamTon = normalizeNum(payload.steamTon)
  const downtimeHours = normalizeNum(payload.downtimeHours)

  if (electricityKwh != null && electricityKwh < 0) throw new Error('用电量不能为负')
  if (steamTon != null && steamTon < 0) throw new Error('蒸汽用量不能为负')
  if (downtimeHours != null && downtimeHours < 0) throw new Error('故障停时不能为负')

  const hasEnergy = electricityKwh != null && electricityKwh > 0
  const hasSteam = steamTon != null && steamTon > 0
  const hasDown = downtimeHours != null && downtimeHours > 0
  if (!hasEnergy && !hasSteam && !hasDown) {
    throw new Error('请至少填写用电、蒸汽或故障停时中的一项')
  }

  return {
    date: dayjs(date).format('YYYY-MM-DD'),
    shift,
    workshop,
    electricityKwh: electricityKwh == null ? 0 : roundNumber(electricityKwh, 2),
    steamTon: steamTon == null ? 0 : roundNumber(steamTon, 3),
    downtimeHours: downtimeHours == null ? 0 : roundNumber(downtimeHours, 2),
    downtimeReason: String(payload.downtimeReason || '').trim(),
    remark: String(payload.remark || '').trim(),
  }
}

export function listShiftEnergyReports({ dateFrom, dateTo, workshop, shift, keyword } = {}) {
  let rows = [...(shiftEnergyReportState.reports || [])]
  if (dateFrom) rows = rows.filter((row) => row.date >= dateFrom)
  if (dateTo) rows = rows.filter((row) => row.date <= dateTo)
  if (workshop) rows = rows.filter((row) => row.workshop === workshop)
  if (shift) rows = rows.filter((row) => row.shift === shift)
  const kw = String(keyword || '')
    .trim()
    .toLowerCase()
  if (kw) {
    rows = rows.filter((row) => {
      const blob = [
        WORKSHOP_LABEL[row.workshop],
        SHIFT_LABEL[row.shift],
        row.reporter,
        row.downtimeReason,
        row.remark,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(kw)
    })
  }
  return rows.sort((a, b) => {
    const d = String(b.date).localeCompare(String(a.date))
    if (d) return d
    if (a.shift !== b.shift) return a.shift === 'day' ? -1 : 1
    return String(a.workshop).localeCompare(String(b.workshop))
  })
}

export function getShiftEnergyReport(id) {
  return (shiftEnergyReportState.reports || []).find((row) => row.id === id) || null
}

export function findShiftEnergyReport(date, shift, workshop) {
  const d = dayjs(date).format('YYYY-MM-DD')
  return (
    (shiftEnergyReportState.reports || []).find(
      (row) => row.date === d && row.shift === shift && row.workshop === workshop,
    ) || null
  )
}

/**
 * 班长交班填报。同一天+班次+车间覆盖更新（一天一班一车间一条）。
 */
export function saveShiftEnergyReport(payload, id) {
  const draft = assertPayload(payload)
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const operator = currentOperator()

  if (id) {
    const row = getShiftEnergyReport(id)
    if (!row) throw new Error('记录不存在')
    const conflict = findShiftEnergyReport(draft.date, draft.shift, draft.workshop)
    if (conflict && conflict.id !== id) {
      throw new Error('该日该班该车间已有填报，请直接编辑原记录')
    }
    Object.assign(row, draft, {
      updatedAt: now,
      updatedBy: operator,
    })
    return row
  }

  const existing = findShiftEnergyReport(draft.date, draft.shift, draft.workshop)
  if (existing) {
    Object.assign(existing, draft, {
      updatedAt: now,
      updatedBy: operator,
    })
    return existing
  }

  const row = {
    id: newId(),
    ...draft,
    reporter: operator,
    createdAt: now,
    updatedAt: now,
    updatedBy: operator,
    source: payload.source || 'web',
  }
  shiftEnergyReportState.reports.unshift(row)
  return row
}

export function deleteShiftEnergyReport(id) {
  const idx = shiftEnergyReportState.reports.findIndex((row) => row.id === id)
  if (idx < 0) throw new Error('记录不存在')
  shiftEnergyReportState.reports.splice(idx, 1)
}

/** 计划期间内交班填报汇总（不按槽次拆分）。 */
export function sumShiftReportsInRange(start, end, { workshop } = {}) {
  const from = dayjs(start).isValid() ? dayjs(start).format('YYYY-MM-DD') : ''
  const to = dayjs(end).isValid() ? dayjs(end).format('YYYY-MM-DD') : ''
  if (!from || !to) {
    return { electricityKwh: 0, steamTon: 0, downtimeHours: 0, reportCount: 0 }
  }
  let electricityKwh = 0
  let steamTon = 0
  let downtimeHours = 0
  let reportCount = 0
  for (const row of shiftEnergyReportState.reports || []) {
    if (row.date < from || row.date > to) continue
    if (workshop && row.workshop !== workshop) continue
    reportCount += 1
    electricityKwh += Number(row.electricityKwh) || 0
    steamTon += Number(row.steamTon) || 0
    downtimeHours += Number(row.downtimeHours) || 0
  }
  return {
    electricityKwh: roundNumber(electricityKwh, 2),
    steamTon: roundNumber(steamTon, 3),
    downtimeHours: roundNumber(downtimeHours, 2),
    reportCount,
  }
}
