import { reactive, watch } from 'vue'
import {
  cloneProcessLibraryFields,
  createProcessLibraryField,
  filterProcessLibraryFields,
  nextProcessLibraryFieldCode,
  nowProcessFieldText,
} from '@/mock/processFieldLibrary'
import { persistJson, safeSetItem } from '@/utils/safeStorage'
import { getUser } from '@/utils/auth'

const STORAGE_KEY = 'i_doms_process_field_library_v1'
const SEED_VERSION_KEY = 'i_doms_process_field_library_seed_v'
const CURRENT_SEED_VERSION = '2'

const SYSTEM_CODES = new Set(['OP_OPERATOR', 'OP_OPERATED_AT', 'OP_EQUIPMENT', 'OP_BATCH_NO'])

function operatorName() {
  const user = getUser()
  return user?.name || user?.realName || user?.username || 'admin1'
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed?.fields)) {
      return parsed.fields.map((f) => createProcessLibraryField(f))
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
  persistJson(STORAGE_KEY, { fields: processFieldLibraryState.fields })
  safeSetItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

export const processFieldLibraryState = reactive({
  fields: shouldReseed()
    ? cloneProcessLibraryFields()
    : loadFromStorage() || cloneProcessLibraryFields(),
})

watch(
  () => processFieldLibraryState.fields,
  () => persist(),
  { deep: true },
)
persist()

export function listProcessLibraryFields(filters = {}) {
  return filterProcessLibraryFields(processFieldLibraryState.fields, filters)
}

export function getProcessLibraryFieldById(id) {
  return processFieldLibraryState.fields.find((f) => f.id === id) || null
}

export function getProcessLibraryFieldByCode(code) {
  const c = String(code || '')
    .trim()
    .toUpperCase()
  if (!c) return null
  return (
    processFieldLibraryState.fields.find(
      (f) =>
        String(f.code || '')
          .trim()
          .toUpperCase() === c,
    ) || null
  )
}

export function addProcessLibraryField(payload = {}) {
  const code =
    String(payload.code || '').trim() ||
    nextProcessLibraryFieldCode(processFieldLibraryState.fields)
  if (SYSTEM_CODES.has(code.toUpperCase())) {
    return { ok: false, message: '系统指标编码不可占用' }
  }
  if (getProcessLibraryFieldByCode(code)) {
    return { ok: false, message: `编码「${code}」已存在` }
  }
  if (!String(payload.name || '').trim()) return { ok: false, message: '请输入指标名称' }
  const now = nowProcessFieldText()
  const op = operatorName()
  const row = createProcessLibraryField({
    ...payload,
    id: `opf-${Date.now()}`,
    code,
    status: payload.status || '启用',
    isSystem: false,
    creator: op,
    createdAt: now,
    updater: op,
    updatedAt: now,
  })
  processFieldLibraryState.fields.unshift(row)
  return { ok: true, field: row }
}

export function updateProcessLibraryField(id, payload = {}) {
  const idx = processFieldLibraryState.fields.findIndex((f) => f.id === id)
  if (idx < 0) return { ok: false, message: '指标不存在' }
  const prev = processFieldLibraryState.fields[idx]
  if (prev.isSystem) {
    return {
      ok: true,
      field: Object.assign(prev, {
        status: payload.status === '停用' ? '停用' : '启用',
        updater: operatorName(),
        updatedAt: nowProcessFieldText(),
      }),
    }
  }
  const next = createProcessLibraryField({
    ...prev,
    ...payload,
    id: prev.id,
    code: prev.code,
    isSystem: false,
    creator: prev.creator,
    createdAt: prev.createdAt,
    updater: operatorName(),
    updatedAt: nowProcessFieldText(),
  })
  processFieldLibraryState.fields[idx] = next
  return { ok: true, field: next }
}

export function removeProcessLibraryField(id) {
  const row = getProcessLibraryFieldById(id)
  if (!row) return { ok: false, message: '指标不存在' }
  if (row.isSystem) return { ok: false, message: '系统指标不可删除' }
  try {
    // eslint-disable-next-line global-require
    const { isProcessFormFieldReferenced } = require('@/store/processFormTemplateStore')
    if (isProcessFormFieldReferenced(row.code)) {
      return { ok: false, message: '已被过程记录模板引用，无法删除' }
    }
  } catch {
    /* ignore */
  }
  processFieldLibraryState.fields = processFieldLibraryState.fields.filter((f) => f.id !== id)
  return { ok: true }
}
