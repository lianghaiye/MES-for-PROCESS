import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { persistJson } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'
import { roundNumber } from '@/utils/numberFormat'
import { itemLabel } from '@/store/processFormulaStore'
import { getWorkCenterById } from '@/store/workCenterStore'
import {
  DEFAULT_SHIFT_WINDOWS,
  enabledSections,
  getShiftReportTemplate,
  resolveShiftReportTemplate,
} from '@/store/shiftReportTemplateStore'

export const SHIFT_ENERGY_REPORT_STORAGE_KEY = 'i_doms_shift_energy_reports'
const REPORT_SEED_VERSION_KEY = 'i_doms_shift_report_seed_v'
/** v4：按工作中心 + 班次时段汇总投料/产出。 */
const REPORT_SEED_VERSION = '4'

export const SHIFT_OPTIONS = [
  { value: 'day', label: '白班' },
  { value: 'night', label: '夜班' },
]

export const SHIFT_LABEL = Object.fromEntries(SHIFT_OPTIONS.map((row) => [row.value, row.label]))

export const WORKSHOP_OPTIONS = [
  { value: 'acid_leach', label: '酸浸车间' },
  { value: 'water_leach', label: '水浸车间' },
  { value: 'evaporation', label: '蒸发浓缩(MVR)' },
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

function normalizeNum(val) {
  if (val === '' || val == null) return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

function sumQty(rows) {
  return roundNumber(
    (rows || []).reduce((acc, row) => acc + (Number(row.qty) || 0), 0),
    3,
  )
}

function listFeedsSafe() {
  // eslint-disable-next-line global-require
  return require('@/store/batchInstructionStore').listFeeds() || []
}

function listOutputsSafe() {
  // eslint-disable-next-line global-require
  return require('@/store/batchInstructionStore').listOutputs() || []
}

function listQcTasksSafe() {
  // eslint-disable-next-line global-require
  return require('@/store/qcTaskStore').listQcTasks() || []
}

export function resolveShiftRange(date, shift, template) {
  const windows = template?.shiftWindows || DEFAULT_SHIFT_WINDOWS
  const win = windows[shift] || DEFAULT_SHIFT_WINDOWS[shift] || DEFAULT_SHIFT_WINDOWS.day
  const day = dayjs(date).format('YYYY-MM-DD')
  const start = dayjs(`${day} ${win.start}`)
  let end = dayjs(`${day} ${win.end}`)
  if (!end.isAfter(start)) end = end.add(1, 'day')
  return {
    start,
    end,
    startText: start.format('YYYY-MM-DD HH:mm'),
    endText: end.format('YYYY-MM-DD HH:mm'),
  }
}

function inShiftRange(at, start, end) {
  const t = dayjs(at)
  if (!t.isValid()) return false
  return !t.isBefore(start) && t.isBefore(end)
}

function matchWorkCenter(rowCenterId, filterCenterId) {
  const want = String(filterCenterId || '').trim()
  if (!want) return true
  return String(rowCenterId || '').trim() === want
}

/** 当班投料按物料合并（可按工作中心过滤）。 */
export function aggregateFeedsForShift(date, shift, { templateId, workCenterId } = {}) {
  const template = templateId
    ? getShiftReportTemplate(templateId)
    : resolveShiftReportTemplate(null)
  const { start, end } = resolveShiftRange(date, shift, template)
  const map = new Map()
  for (const feed of listFeedsSafe()) {
    if (!inShiftRange(feed.at, start, end)) continue
    if (!matchWorkCenter(feed.workCenterId, workCenterId)) continue
    const itemId = feed.itemId || ''
    const name = itemLabel(itemId) || feed.itemName || itemId || '未知名物料'
    const key = itemId || name
    const prev = map.get(key) || {
      itemId,
      name,
      qty: 0,
      unit: 't',
      source: 'auto',
      feedCount: 0,
    }
    prev.qty = roundNumber(prev.qty + (Number(feed.qty) || 0), 3)
    prev.feedCount += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
}

/** 当班产出按物料合并（可按工作中心过滤）。 */
export function aggregateOutputsForShift(date, shift, { templateId, workCenterId } = {}) {
  const template = templateId
    ? getShiftReportTemplate(templateId)
    : resolveShiftReportTemplate(null)
  const { start, end } = resolveShiftRange(date, shift, template)
  const map = new Map()
  for (const out of listOutputsSafe()) {
    if (!inShiftRange(out.at, start, end)) continue
    if (!matchWorkCenter(out.workCenterId, workCenterId)) continue
    const itemId = out.itemId || ''
    const name = itemLabel(itemId) || out.itemName || itemId || '未知名物料'
    const key = `${itemId || name}::${out.role || ''}`
    const prev = map.get(key) || {
      itemId,
      name,
      role: out.role || '',
      qty: 0,
      unit: 't',
      source: 'auto',
      outputCount: 0,
    }
    prev.qty = roundNumber(prev.qty + (Number(out.qty) || 0), 3)
    prev.outputCount += 1
    map.set(key, prev)
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
}

/** 当班化验任务（按检验完成时间，无则用创建时间；可按工作中心过滤）。 */
export function aggregateAssaysForShift(date, shift, { templateId, workCenterId } = {}) {
  const template = templateId
    ? getShiftReportTemplate(templateId)
    : resolveShiftReportTemplate(null)
  const { start, end } = resolveShiftRange(date, shift, template)
  const centerName = workCenterId ? getWorkCenterById(workCenterId)?.name || '' : ''
  const rows = []
  for (const task of listQcTasksSafe()) {
    const at = task.inspectedAt || task.updatedAt || task.createdAt
    if (!inShiftRange(at, start, end)) continue
    if (workCenterId) {
      const taskCenter = String(task.workCenterId || task.workCenter || '').trim()
      // 已挂工作中心的化验单必须匹配；未挂的仍纳入本班，避免一期漏数
      if (taskCenter && taskCenter !== workCenterId && !(centerName && taskCenter === centerName)) {
        continue
      }
    }
    rows.push({
      id: task.id,
      qcNo: task.qcNo || '',
      itemName: task.itemName || itemLabel(task.itemId) || '—',
      assayType: task.assayType || task.assaySchemeName || task.bizScope || '—',
      qcStatus: task.qcStatus || '—',
      qcResult: task.qcResult || '',
      inspector: task.inspector || '',
      at: at ? dayjs(at).format('YYYY-MM-DD HH:mm') : '',
      source: 'auto',
    })
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

export function buildEmptyReportForm(workCenterId = 'wc-acid-1', template) {
  const tpl = template || resolveShiftReportTemplate(null)
  const textValues = {}
  for (const sec of enabledSections(tpl)) {
    if (sec.type === 'text' && sec.textKey) textValues[sec.textKey] = ''
  }
  return {
    date: dayjs(),
    shift: 'night',
    workCenterId,
    workshop: '',
    templateId: tpl?.id || '',
    plannedCount: null,
    actualCount: null,
    feedRows: [],
    outputRows: [],
    assayRows: [],
    feedAutoSyncedAt: '',
    outputAutoSyncedAt: '',
    assayAutoSyncedAt: '',
    electricityKwh: null,
    steamTon: null,
    downtimeHours: null,
    downtimeReason: '',
    textValues,
  }
}

function normalizeQtyRows(rows, { withRole = false } = {}) {
  if (!Array.isArray(rows)) return []
  return rows
    .map((row) => {
      const name = String(row.name || '').trim()
      if (!name && !row.itemId) return null
      const qty = normalizeNum(row.qty)
      const base = {
        itemId: row.itemId || '',
        name: name || itemLabel(row.itemId) || '—',
        qty: qty == null ? 0 : roundNumber(qty, 3),
        unit: String(row.unit || 't').trim() || 't',
        source: row.source === 'manual' ? 'manual' : 'auto',
      }
      if (withRole) base.role = row.role || ''
      return base
    })
    .filter(Boolean)
}

function normalizeAssayRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => ({
    id: row.id || '',
    qcNo: row.qcNo || '',
    itemName: row.itemName || '—',
    assayType: row.assayType || '—',
    qcStatus: row.qcStatus || '—',
    qcResult: row.qcResult || '',
    inspector: row.inspector || '',
    at: row.at || '',
    source: row.source === 'manual' ? 'manual' : 'auto',
  }))
}

function resolveWorkCenterMeta(workCenterId, fallbackName = '') {
  const center = getWorkCenterById(workCenterId)
  return {
    workCenterId: String(workCenterId || '').trim(),
    workCenterName: center?.name || String(fallbackName || '').trim(),
  }
}

function normalizeStoredRow(row) {
  if (!row || typeof row !== 'object') return row
  const meta = resolveWorkCenterMeta(row.workCenterId, row.workCenterName)
  return {
    ...row,
    ...meta,
    workshop: row.workshop || '',
    templateId: row.templateId || '',
    plannedCount: row.plannedCount ?? null,
    actualCount: row.actualCount ?? null,
    feedRows: Array.isArray(row.feedRows) ? row.feedRows : [],
    outputRows: Array.isArray(row.outputRows) ? row.outputRows : [],
    assayRows: Array.isArray(row.assayRows) ? row.assayRows : [],
    feedAutoSyncedAt: row.feedAutoSyncedAt || '',
    outputAutoSyncedAt: row.outputAutoSyncedAt || '',
    assayAutoSyncedAt: row.assayAutoSyncedAt || '',
    textValues: row.textValues && typeof row.textValues === 'object' ? row.textValues : {},
    electricityKwh: row.electricityKwh ?? 0,
    steamTon: row.steamTon ?? 0,
    downtimeHours: row.downtimeHours ?? 0,
    downtimeReason: String(row.downtimeReason || ''),
    abnormalities: String(row.abnormalities || row.textValues?.abnormalities || ''),
    remark: String(row.remark || row.textValues?.remark || ''),
  }
}

function buildDemoReports() {
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  return [
    {
      id: 'ser-demo-mvr-20251014-night',
      date: '2025-10-14',
      shift: 'night',
      workCenterId: 'wc-mvr',
      workCenterName: '蒸发浓缩',
      workshop: 'evaporation',
      templateId: 'tpl-mvr',
      plannedCount: 2,
      actualCount: 2,
      feedRows: [],
      outputRows: [
        { itemId: '', name: '母液浓缩液', role: 'main', qty: 16, unit: '方', source: 'manual' },
      ],
      assayRows: [],
      feedAutoSyncedAt: '',
      outputAutoSyncedAt: '',
      assayAutoSyncedAt: '',
      electricityKwh: 1860,
      steamTon: 12.5,
      downtimeHours: 0,
      downtimeReason: '',
      textValues: { abnormalities: '', remark: '00:00 开机；进料约 253 方，蒸发约 160 方' },
      abnormalities: '',
      remark: '00:00 开机；进料约 253 方，蒸发约 160 方',
      feedTotalTon: 0,
      outputTotalTon: 16,
      reporter: '王杏',
      createdAt: now,
      updatedAt: now,
      updatedBy: '王杏',
      source: 'demo',
    },
    {
      id: 'ser-demo-acid-20251014-night',
      date: '2025-10-14',
      shift: 'night',
      workCenterId: 'wc-acid-1',
      workCenterName: '酸浸一线',
      workshop: 'acid_leach',
      templateId: 'tpl-acid',
      plannedCount: 10,
      actualCount: 10,
      feedRows: [
        { itemId: '', name: '瑞麒', qty: 42, unit: 't', source: 'manual' },
        { itemId: '', name: '黄渣', qty: 28, unit: 't', source: 'manual' },
      ],
      outputRows: [
        { itemId: '', name: '精卤', role: 'main', qty: 102, unit: '方', source: 'manual' },
      ],
      assayRows: [
        {
          id: 'demo-qc-1',
          qcNo: 'ZJ-DEMO-001',
          itemName: '精卤',
          assayType: '中控取样',
          qcStatus: '已完成',
          qcResult: '合格',
          inspector: '化验室',
          at: '2025-10-15 06:20',
          source: 'manual',
        },
      ],
      feedAutoSyncedAt: '',
      outputAutoSyncedAt: '',
      assayAutoSyncedAt: '',
      electricityKwh: 920,
      steamTon: 0,
      downtimeHours: 2,
      downtimeReason: '5-2 搅拌机变频器更换',
      textValues: {
        abnormalities: '5#浆化槽搅拌机变频器烧毁已更换；加酸管阀门漏酸已更换。',
        remark: '',
      },
      abnormalities: '5#浆化槽搅拌机变频器烧毁已更换；加酸管阀门漏酸已更换。',
      remark: '',
      feedTotalTon: 70,
      outputTotalTon: 102,
      reporter: '闵勇',
      createdAt: now,
      updatedAt: '2025-10-15 08:10',
      updatedBy: '闵勇',
      source: 'demo',
    },
  ]
}

function load() {
  try {
    const raw = localStorage.getItem(SHIFT_ENERGY_REPORT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(normalizeStoredRow) : []
  } catch {
    return []
  }
}

function ensureSeeded(list) {
  const versionOk = localStorage.getItem(REPORT_SEED_VERSION_KEY) === REPORT_SEED_VERSION
  if (versionOk && Array.isArray(list) && list.length) return list.map(normalizeStoredRow)
  const demo = buildDemoReports()
  persistJson(SHIFT_ENERGY_REPORT_STORAGE_KEY, demo)
  localStorage.setItem(REPORT_SEED_VERSION_KEY, REPORT_SEED_VERSION)
  return demo
}

export const shiftEnergyReportState = reactive({
  reports: ensureSeeded(load()),
})

watch(
  () => shiftEnergyReportState.reports,
  (list) => persistJson(SHIFT_ENERGY_REPORT_STORAGE_KEY, list),
  { deep: true },
)

function newId() {
  return `ser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function assertPayload(payload) {
  const date = String(payload.date || '').trim()
  if (!dayjs(date).isValid()) throw new Error('请选择日期')
  const shift = payload.shift
  if (!SHIFT_LABEL[shift]) throw new Error('请选择班次')
  const workCenterId = String(payload.workCenterId || '').trim()
  if (!workCenterId) throw new Error('请选择工作中心')
  const center = getWorkCenterById(workCenterId)
  if (!center) throw new Error('工作中心不存在或已停用')
  const workCenterName = center.name || ''
  const workshop = String(payload.workshop || '').trim()

  const template =
    (payload.templateId && getShiftReportTemplate(payload.templateId)) ||
    resolveShiftReportTemplate(workshop || null)
  if (!template) throw new Error('请先配置交班模板')

  const plannedCount = normalizeNum(payload.plannedCount)
  const actualCount = normalizeNum(payload.actualCount)
  if (plannedCount != null && plannedCount < 0) throw new Error('应到人数不能为负')
  if (actualCount != null && actualCount < 0) throw new Error('实到人数不能为负')

  const electricityKwh = normalizeNum(payload.electricityKwh)
  const steamTon = normalizeNum(payload.steamTon)
  const downtimeHours = normalizeNum(payload.downtimeHours)
  if (electricityKwh != null && electricityKwh < 0) throw new Error('用电量不能为负')
  if (steamTon != null && steamTon < 0) throw new Error('蒸汽用量不能为负')
  if (downtimeHours != null && downtimeHours < 0) throw new Error('故障停时不能为负')

  const feedRows = normalizeQtyRows(payload.feedRows)
  const outputRows = normalizeQtyRows(payload.outputRows, { withRole: true })
  const assayRows = normalizeAssayRows(payload.assayRows)
  const textValues = { ...(payload.textValues || {}) }
  const downtimeReason = String(payload.downtimeReason || '').trim()
  const abnormalities = String(textValues.abnormalities ?? payload.abnormalities ?? '').trim()
  const remark = String(textValues.remark ?? payload.remark ?? '').trim()
  textValues.abnormalities = abnormalities
  textValues.remark = remark

  const hasAttendance = plannedCount != null || actualCount != null
  const hasFeed = feedRows.some((r) => r.qty > 0)
  const hasOut = outputRows.some((r) => r.qty > 0)
  const hasAssay = assayRows.length > 0
  const hasEnergy =
    (electricityKwh != null && electricityKwh > 0) ||
    (steamTon != null && steamTon > 0) ||
    (downtimeHours != null && downtimeHours > 0)
  const hasText = Boolean(abnormalities || remark || downtimeReason)

  if (!hasAttendance && !hasFeed && !hasOut && !hasAssay && !hasEnergy && !hasText) {
    throw new Error('请至少同步投料/产出/化验，或填写能耗、停时、异常中的一项')
  }

  return {
    date: dayjs(date).format('YYYY-MM-DD'),
    shift,
    workCenterId,
    workCenterName,
    workshop,
    templateId: template.id,
    plannedCount: plannedCount == null ? null : Math.round(plannedCount),
    actualCount: actualCount == null ? null : Math.round(actualCount),
    feedRows,
    outputRows,
    assayRows,
    feedAutoSyncedAt: String(payload.feedAutoSyncedAt || '').trim(),
    outputAutoSyncedAt: String(payload.outputAutoSyncedAt || '').trim(),
    assayAutoSyncedAt: String(payload.assayAutoSyncedAt || '').trim(),
    electricityKwh: electricityKwh == null ? 0 : roundNumber(electricityKwh, 2),
    steamTon: steamTon == null ? 0 : roundNumber(steamTon, 3),
    downtimeHours: downtimeHours == null ? 0 : roundNumber(downtimeHours, 2),
    downtimeReason,
    textValues,
    abnormalities,
    remark,
    feedTotalTon: sumQty(feedRows),
    outputTotalTon: sumQty(outputRows),
  }
}

export function listShiftEnergyReports({
  dateFrom,
  dateTo,
  workCenterId,
  workshop,
  shift,
  keyword,
} = {}) {
  let rows = [...(shiftEnergyReportState.reports || [])]
  if (dateFrom) rows = rows.filter((row) => row.date >= dateFrom)
  if (dateTo) rows = rows.filter((row) => row.date <= dateTo)
  if (workCenterId) rows = rows.filter((row) => row.workCenterId === workCenterId)
  if (workshop) rows = rows.filter((row) => row.workshop === workshop)
  if (shift) rows = rows.filter((row) => row.shift === shift)
  const kw = String(keyword || '')
    .trim()
    .toLowerCase()
  if (kw) {
    rows = rows.filter((row) => {
      const blob = [
        row.workCenterName,
        WORKSHOP_LABEL[row.workshop],
        SHIFT_LABEL[row.shift],
        row.reporter,
        row.downtimeReason,
        row.abnormalities,
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
    return String(a.workCenterName || a.workshop).localeCompare(
      String(b.workCenterName || b.workshop),
      'zh-CN',
    )
  })
}

export function getShiftEnergyReport(id) {
  return (shiftEnergyReportState.reports || []).find((row) => row.id === id) || null
}

/** 唯一键：日期 + 班次 + 工作中心。兼容旧数据无 workCenterId 时回退车间。 */
export function findShiftEnergyReport(date, shift, workCenterId, workshop) {
  const d = dayjs(date).format('YYYY-MM-DD')
  const centerId = String(workCenterId || '').trim()
  return (
    (shiftEnergyReportState.reports || []).find((row) => {
      if (row.date !== d || row.shift !== shift) return false
      if (centerId) return String(row.workCenterId || '') === centerId
      if (workshop) return row.workshop === workshop
      return false
    }) || null
  )
}

export function saveShiftEnergyReport(payload, id) {
  const draft = assertPayload(payload)
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const operator = currentOperator()

  if (id) {
    const row = getShiftEnergyReport(id)
    if (!row) throw new Error('记录不存在')
    const conflict = findShiftEnergyReport(draft.date, draft.shift, draft.workCenterId)
    if (conflict && conflict.id !== id) {
      throw new Error('该日该班该工作中心已有填报，请直接编辑原记录')
    }
    Object.assign(row, draft, { updatedAt: now, updatedBy: operator })
    return row
  }

  const existing = findShiftEnergyReport(draft.date, draft.shift, draft.workCenterId)
  if (existing) {
    Object.assign(existing, draft, { updatedAt: now, updatedBy: operator })
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

export function sumShiftReportsInRange(start, end, { workshop, workCenterId } = {}) {
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
    if (workCenterId && row.workCenterId !== workCenterId) continue
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

export function formatShiftReportPreview(record) {
  if (!record) return ''
  const template =
    getShiftReportTemplate(record.templateId) || resolveShiftReportTemplate(record.workshop)
  const centerName =
    record.workCenterName ||
    getWorkCenterById(record.workCenterId)?.name ||
    WORKSHOP_LABEL[record.workshop] ||
    '工作中心'
  const shiftName = SHIFT_LABEL[record.shift] || ''
  const lines = [`${centerName}${shiftName}工作汇报`]
  const dateLabel = dayjs(record.date).isValid()
    ? `${dayjs(record.date).month() + 1}月${dayjs(record.date).date()}日`
    : record.date
  lines.push(dateLabel)

  for (const sec of enabledSections(template)) {
    if (sec.type === 'attendance') {
      if (record.plannedCount != null || record.actualCount != null) {
        lines.push(
          `${sec.title || '出勤'}：应到${record.plannedCount ?? '—'}人，实到${
            record.actualCount ?? '—'
          }人。`,
        )
      }
      continue
    }
    if (sec.type === 'feed_summary') {
      const feeds = record.feedRows || []
      if (!feeds.length) continue
      lines.push(`${sec.title || '投料汇总'}：合计${sumQty(feeds)}吨`)
      feeds.forEach((r) => lines.push(`${r.name}${r.qty}${r.unit || 't'}`))
      continue
    }
    if (sec.type === 'output_summary') {
      const outs = record.outputRows || []
      if (!outs.length) continue
      lines.push(`${sec.title || '产出汇总'}：合计${sumQty(outs)}`)
      outs.forEach((r) => lines.push(`${r.name}${r.qty}${r.unit || ''}`))
      continue
    }
    if (sec.type === 'assay_summary') {
      const assays = record.assayRows || []
      if (!assays.length) continue
      lines.push(`${sec.title || '本班化验'}：${assays.length} 单`)
      assays.forEach((r) => {
        const result = r.qcResult || r.qcStatus || '—'
        lines.push(`${r.qcNo || ''} ${r.itemName} ${r.assayType} ${result}`.trim())
      })
      continue
    }
    if (sec.type === 'energy') {
      const energyBits = []
      if (Number(record.electricityKwh) > 0) energyBits.push(`用电${record.electricityKwh}kWh`)
      if (Number(record.steamTon) > 0) energyBits.push(`蒸汽${record.steamTon}t`)
      if (Number(record.downtimeHours) > 0) {
        energyBits.push(`故障停时${record.downtimeHours}h`)
      }
      if (energyBits.length) {
        lines.push(`${sec.title || '能耗/停时'}：${energyBits.join('，')}`)
        if (record.downtimeReason) lines.push(`停时说明：${record.downtimeReason}`)
      }
      continue
    }
    if (sec.type === 'text') {
      const key = sec.textKey
      const val = String(record.textValues?.[key] ?? record[key] ?? '').trim()
      if (!val) continue
      lines.push(`${sec.title || '说明'}：`)
      lines.push(val)
    }
  }

  return lines.join('\n')
}
