import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { processLibraryFieldToTemplateField } from '@/mock/processFieldLibrary'
import {
  createProcessFormTemplate,
  createProcessFormTemplateSeed,
} from '@/mock/processFormTemplateSeed'
import { persistJson, safeSetItem } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'

const STORAGE_KEY = 'i_doms_process_form_template_v2'
const SEED_VERSION_KEY = 'i_doms_process_form_template_seed_v'
const CURRENT_SEED_VERSION = '3'

function nowText() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}

function operatorName() {
  const user = getUser()
  return user?.name || user?.realName || user?.username || 'admin1'
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.templates))
      return parsed.templates.map((t) => createProcessFormTemplate(t))
  } catch {
    /* ignore */
  }
  return null
}

function shouldReseed() {
  return localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION
}

function persist() {
  persistJson(STORAGE_KEY, { templates: processFormTemplateState.templates })
  safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

export const processFormTemplateState = reactive({
  templates: shouldReseed()
    ? createProcessFormTemplateSeed()
    : loadFromStorage() || createProcessFormTemplateSeed(),
})

watch(
  () => processFormTemplateState.templates,
  () => persist(),
  { deep: true },
)
persist()

export function listProcessFormTemplates(filters = {}) {
  return (processFormTemplateState.templates || []).filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.code && !(row.code || '').includes(String(filters.code).trim())) return false
    if (filters.name && !(row.name || '').includes(String(filters.name).trim())) return false
    if (filters.keyword) {
      const kw = String(filters.keyword).trim().toLowerCase()
      const hay = `${row.code || ''} ${row.name || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
}

export function listEnabledProcessFormTemplateOptions() {
  return listProcessFormTemplates({ status: '启用' }).map((t) => ({
    value: t.id,
    label: t.code ? `${t.name}（${t.code}）` : t.name,
  }))
}

export function getProcessFormTemplateById(id) {
  return processFormTemplateState.templates.find((t) => t.id === id) || null
}

export function nextProcessFormTemplateCode() {
  const nums = processFormTemplateState.templates
    .map((t) => {
      const m = String(t.code || '').match(/PFT-.*?(\d+)$/i)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `PFT-${String(next).padStart(3, '0')}`
}

export function isProcessFormFieldReferenced(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase()
  if (!c) return false
  return processFormTemplateState.templates.some((t) =>
    (t.fields || []).some(
      (f) =>
        String(f.code || '')
          .trim()
          .toUpperCase() === c,
    ),
  )
}

function normalizeFieldsFromLibrary(fields = []) {
  return (fields || []).map((f, idx) => {
    const snap = f.libraryFieldId || f.code ? { ...f } : processLibraryFieldToTemplateField(f)
    return {
      ...snap,
      sortOrder: snap.sortOrder ?? idx + 1,
      required: snap.required !== false,
    }
  })
}

export function addProcessFormTemplate(payload = {}) {
  const name = String(payload.name || '').trim()
  if (!name) return { ok: false, message: '请输入模板名称' }
  const code = String(payload.code || '').trim() || nextProcessFormTemplateCode()
  if (processFormTemplateState.templates.some((t) => t.code === code)) {
    return { ok: false, message: `模板编码「${code}」已存在` }
  }
  const fields = normalizeFieldsFromLibrary(payload.fields)
  if (!fields.length) return { ok: false, message: '请至少添加一个指标' }
  const op = operatorName()
  const now = nowText()
  const row = createProcessFormTemplate({
    ...payload,
    id: `pft-${Date.now()}`,
    code,
    name,
    fields,
    creator: op,
    createdAt: now,
    updater: op,
    updatedAt: now,
  })
  processFormTemplateState.templates.unshift(row)
  return { ok: true, template: row }
}

export function updateProcessFormTemplate(id, payload = {}) {
  const idx = processFormTemplateState.templates.findIndex((t) => t.id === id)
  if (idx < 0) return { ok: false, message: '模板不存在' }
  const prev = processFormTemplateState.templates[idx]
  const name = String(payload.name ?? prev.name).trim()
  if (!name) return { ok: false, message: '请输入模板名称' }
  const code = String(payload.code ?? prev.code).trim()
  if (code && processFormTemplateState.templates.some((t) => t.id !== id && t.code === code)) {
    return { ok: false, message: `模板编码「${code}」已存在` }
  }
  const fields = normalizeFieldsFromLibrary(payload.fields ?? prev.fields)
  if (!fields.length) return { ok: false, message: '请至少添加一个指标' }
  const next = createProcessFormTemplate({
    ...prev,
    ...payload,
    id: prev.id,
    code: code || prev.code,
    name,
    fields,
    creator: prev.creator,
    createdAt: prev.createdAt,
    updater: operatorName(),
    updatedAt: nowText(),
  })
  processFormTemplateState.templates[idx] = next
  return { ok: true, template: next }
}

export function setProcessFormTemplateStatus(id, status) {
  const row = getProcessFormTemplateById(id)
  if (!row) return { ok: false, message: '模板不存在' }
  row.status = status === '停用' ? '停用' : '启用'
  row.updater = operatorName()
  row.updatedAt = nowText()
  return { ok: true, template: row }
}

export function removeProcessFormTemplate(id) {
  const idx = processFormTemplateState.templates.findIndex((t) => t.id === id)
  if (idx < 0) return { ok: false, message: '模板不存在' }
  processFormTemplateState.templates.splice(idx, 1)
  return { ok: true }
}
