import { reactive, watch } from 'vue'
import { persistJson } from '@/utils/safeStorage'

export const SHIFT_REPORT_TEMPLATE_STORAGE_KEY = 'i_doms_shift_report_templates'
const TEMPLATE_SEED_VERSION_KEY = 'i_doms_shift_report_tpl_v'
/** v3：一期收成投料/产出/化验/能耗，去掉设备压卸板。 */
const TEMPLATE_SEED_VERSION = '3'

export const DEFAULT_SHIFT_WINDOWS = {
  day: { start: '08:00', end: '20:00' },
  night: { start: '20:00', end: '08:00' },
}

/**
 * 一期区块：
 * attendance / feed_summary / output_summary / assay_summary / energy / text
 * （设备状态二期再开，避免罐子填压板数这类错配）
 */
export const SECTION_TYPE_OPTIONS = [
  { value: 'attendance', label: '出勤' },
  { value: 'feed_summary', label: '投料汇总(自动)' },
  { value: 'output_summary', label: '产出汇总(自动)' },
  { value: 'assay_summary', label: '化验汇总(自动)' },
  { value: 'energy', label: '能耗与停时' },
  { value: 'text', label: '文本说明' },
]

function uid(prefix = 'sec') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export function createSection(type, patch = {}) {
  const base = { id: uid('sec'), type, title: '', enabled: true }
  if (type === 'attendance') return { ...base, title: '出勤情况', ...patch }
  if (type === 'feed_summary') {
    return { ...base, title: '投料汇总', allowManualAdjust: true, ...patch }
  }
  if (type === 'output_summary') {
    return { ...base, title: '产出汇总', allowManualAdjust: true, ...patch }
  }
  if (type === 'assay_summary') {
    return { ...base, title: '本班化验', ...patch }
  }
  if (type === 'energy') return { ...base, title: '能耗与停时', ...patch }
  if (type === 'text') {
    return {
      ...base,
      title: patch.title || '说明',
      textKey: patch.textKey || `text_${uid('tk')}`,
      ...patch,
    }
  }
  return { ...base, ...patch }
}

function phase1Sections(prefix) {
  return [
    createSection('attendance', { id: `${prefix}-att` }),
    createSection('feed_summary', { id: `${prefix}-feed` }),
    createSection('output_summary', { id: `${prefix}-out` }),
    createSection('assay_summary', { id: `${prefix}-assay` }),
    createSection('energy', { id: `${prefix}-energy` }),
    createSection('text', {
      id: `${prefix}-abn`,
      title: '异常情况',
      textKey: 'abnormalities',
    }),
    createSection('text', { id: `${prefix}-remark`, title: '备注', textKey: 'remark' }),
  ]
}

function buildBuiltinTemplates() {
  return [
    {
      id: 'tpl-generic',
      name: '一期通用交班',
      workshop: '',
      remark: '按班次时段自动汇总投料/产出/化验，手工填能耗停时',
      shiftWindows: { ...DEFAULT_SHIFT_WINDOWS },
      sections: phase1Sections('g'),
      updatedAt: '2026-11-24 16:30',
    },
    {
      id: 'tpl-acid',
      name: '酸浸车间交班',
      workshop: 'acid_leach',
      remark: '绑定酸浸车间；字段同一期通用',
      shiftWindows: { ...DEFAULT_SHIFT_WINDOWS },
      sections: phase1Sections('a'),
      updatedAt: '2026-11-24 16:30',
    },
    {
      id: 'tpl-mvr',
      name: '蒸发浓缩(MVR)交班',
      workshop: 'evaporation',
      remark: '绑定蒸发浓缩；字段同一期通用',
      shiftWindows: { ...DEFAULT_SHIFT_WINDOWS },
      sections: phase1Sections('m'),
      updatedAt: '2026-11-24 16:30',
    },
  ]
}

function load() {
  try {
    const raw = localStorage.getItem(SHIFT_REPORT_TEMPLATE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function ensureTemplates(list) {
  const versionOk = localStorage.getItem(TEMPLATE_SEED_VERSION_KEY) === TEMPLATE_SEED_VERSION
  if (versionOk && Array.isArray(list) && list.length) return list
  const seed = buildBuiltinTemplates()
  persistJson(SHIFT_REPORT_TEMPLATE_STORAGE_KEY, seed)
  localStorage.setItem(TEMPLATE_SEED_VERSION_KEY, TEMPLATE_SEED_VERSION)
  return seed
}

export const shiftReportTemplateState = reactive({
  templates: ensureTemplates(load()),
})

watch(
  () => shiftReportTemplateState.templates,
  (list) => persistJson(SHIFT_REPORT_TEMPLATE_STORAGE_KEY, list),
  { deep: true },
)

export function listShiftReportTemplates() {
  return [...(shiftReportTemplateState.templates || [])]
}

export function getShiftReportTemplate(id) {
  return (shiftReportTemplateState.templates || []).find((row) => row.id === id) || null
}

export function resolveShiftReportTemplate(workshop) {
  const list = shiftReportTemplateState.templates || []
  if (workshop) {
    const hit = list.find((row) => row.workshop === workshop)
    if (hit) return hit
  }
  return list.find((row) => !row.workshop) || list[0] || null
}

export function saveShiftReportTemplate(payload, id) {
  const name = String(payload.name || '').trim()
  if (!name) throw new Error('请填写模板名称')
  const sections = Array.isArray(payload.sections) ? payload.sections : []
  if (!sections.length) throw new Error('请至少配置一个区块')

  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`

  const draft = {
    name,
    workshop: String(payload.workshop || ''),
    remark: String(payload.remark || '').trim(),
    shiftWindows: payload.shiftWindows || { ...DEFAULT_SHIFT_WINDOWS },
    sections,
    updatedAt: stamp,
  }

  if (id) {
    const row = getShiftReportTemplate(id)
    if (!row) throw new Error('模板不存在')
    Object.assign(row, draft)
    return row
  }

  const row = { id: `tpl-${Date.now().toString(36)}`, ...draft }
  shiftReportTemplateState.templates.push(row)
  return row
}

export function deleteShiftReportTemplate(id) {
  if (id === 'tpl-generic') throw new Error('通用模板不可删除，可复制后修改')
  const idx = shiftReportTemplateState.templates.findIndex((row) => row.id === id)
  if (idx < 0) throw new Error('模板不存在')
  shiftReportTemplateState.templates.splice(idx, 1)
}

export function duplicateShiftReportTemplate(id) {
  const src = getShiftReportTemplate(id)
  if (!src) throw new Error('模板不存在')
  const copy = JSON.parse(JSON.stringify(src))
  copy.id = `tpl-${Date.now().toString(36)}`
  copy.name = `${src.name}（副本）`
  copy.workshop = ''
  copy.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  shiftReportTemplateState.templates.push(copy)
  return copy
}

export function enabledSections(template) {
  return (template?.sections || []).filter((sec) => sec && sec.enabled !== false)
}
