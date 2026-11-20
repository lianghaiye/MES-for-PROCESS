/**
 * 检验项库（质检字段库）mock
 */
import dayjs from 'dayjs'
import { isQcSystemFixedField, createPresetConclusionField } from '@/utils/qcConclusionField'
import {
  QC_FIELD_JUDGE_RULE,
  QC_UNIT_POSITION,
  buildStandardText,
  pickFieldStandardProps,
} from '@/utils/qcFieldStandard'
import { isComplexField, pickComplexFieldProps } from '@/utils/qcComplexField'

export { QC_UNIT_POSITION }

export const qcFieldLibraryStatusOptions = ['启用', '停用']

export const qcFieldLibraryCategoryOptions = [
  '外观',
  '尺寸',
  '性能',
  '材料',
  '功能',
  '执行',
  '其他',
]

/** 字段取值来源：手工录入 | 系统带出 */
export const QC_FIELD_VALUE_SOURCE = {
  MANUAL: 'manual',
  SYSTEM: 'system',
}

/** 工序执行用系统指标键 */
export const PROCESS_FORM_SYSTEM_KEYS = {
  OPERATOR: 'operator',
  OPERATED_AT: 'operatedAt',
  EQUIPMENT: 'equipment',
  BATCH_NO: 'batchNo',
}

export const qcFieldLibraryTypeOptions = [
  { value: 'text', label: '文本框' },
  { value: 'textarea', label: '文本域' },
  { value: 'number', label: '数字' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
  { value: 'radio', label: '单选' },
  { value: 'checkbox', label: '多选' },
  { value: 'composite', label: '复合项（多子项）' },
]

/** 基础字段类型（不含复合） */
export const qcFieldLibraryBasicTypeOptions = qcFieldLibraryTypeOptions.filter(
  (o) => o.value !== 'composite',
)

/** @deprecated 保留兼容；编辑表单已改为指标类型分流 */
export const qcFieldLibraryTypeGroupedOptions = [
  {
    label: '基础类型',
    options: qcFieldLibraryBasicTypeOptions,
  },
  {
    label: '复合类型',
    options: [{ value: 'composite', label: '复合项（一组子项，类型/判定可各自配置）' }],
  },
]

export function qcFieldTypeLabel(type) {
  return qcFieldLibraryTypeOptions.find((o) => o.value === type)?.label || type || '—'
}

/** 列表/详情中字段类型 Tag 色：对齐「本单工序-资源类型」边框标签风格 */
export function fieldTypeTagColor(type) {
  if (type === 'composite') return 'blue'
  if (type === 'matrix') return 'processing'
  if (type === 'radio' || type === 'checkbox') return 'geekblue'
  if (type === 'number') return 'cyan'
  return 'default'
}

function normalizeOptionRows(partial = {}) {
  const options = Array.isArray(partial.options) ? [...partial.options] : []
  const isChoice = partial.type === 'radio' || partial.type === 'checkbox'
  if (!isChoice) return []
  const rows = Array.isArray(partial.optionRows)
    ? partial.optionRows.map((o) => ({
        value: String(o?.value ?? o ?? '').trim(),
        isDefault: Boolean(o?.isDefault),
        allowFill: Boolean(o?.allowFill),
        fillPlaceholder: String(o?.fillPlaceholder ?? ''),
      }))
    : []
  if (rows.length) return rows.filter((o) => o.value)
  const def = String(partial.defaultValue ?? '').trim()
  return options
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .map((value) => ({
      value,
      isDefault: Boolean(def && value === def),
      allowFill: false,
      fillPlaceholder: '',
    }))
}

export function createQcLibraryField(partial = {}) {
  const options = Array.isArray(partial.options) ? [...partial.options] : []
  const optionRows = normalizeOptionRows({ ...partial, options })
  const standard = pickFieldStandardProps({ ...partial, options })
  const complex = pickComplexFieldProps(partial)
  const row = {
    id: partial.id || `qcf-${Date.now()}`,
    code: String(partial.code || '').trim(),
    name: String(partial.name || '').trim(),
    type: partial.type || 'text',
    status: partial.status || '启用',
    category: partial.category || '其他',
    required: Boolean(partial.required),
    allowDecimal: Boolean(partial.allowDecimal),
    description: partial.description || '',
    placeholder: partial.placeholder || '',
    options,
    optionRows,
    defaultValue: partial.defaultValue ?? '',
    format: partial.format || '',
    charLimit: partial.charLimit ?? null,
    isSystem: Boolean(partial.isSystem),
    valueSource:
      partial.valueSource === QC_FIELD_VALUE_SOURCE.SYSTEM
        ? QC_FIELD_VALUE_SOURCE.SYSTEM
        : QC_FIELD_VALUE_SOURCE.MANUAL,
    systemKey: String(partial.systemKey || '').trim(),
    /** 适用场景：qc / process；空视为两者都可用 */
    bizScopes: Array.isArray(partial.bizScopes)
      ? [...new Set(partial.bizScopes.map((s) => String(s || '').trim()).filter(Boolean))]
      : [],
    ...standard,
    ...complex,
    creator: partial.creator || 'admin1',
    createdAt: partial.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    updater: partial.updater || partial.creator || 'admin1',
    updatedAt: partial.updatedAt || partial.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  if (isComplexField(row)) {
    row.standardText =
      row.standardText || (row.type === 'composite' ? '含子项分别判定' : '多点测点录入')
  } else if (!row.standardText) {
    row.standardText = buildStandardText(row)
  }
  return row
}

/** 演示种子：系统默认项 + 常见检验项 */
export const mockQcLibraryFields = [
  createQcLibraryField({
    id: 'qcf-sys-method',
    code: 'QC_INSPECT_METHOD',
    name: '质检方式',
    type: 'radio',
    status: '启用',
    category: '其他',
    required: true,
    isSystem: true,
    bizScopes: ['qc'],
    options: ['抽检', '全检'],
    defaultValue: '抽检',
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    placeholder: '请选择质检方式',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createQcLibraryField({
    id: 'qcf-sys-qty',
    code: 'QC_INSPECT_QTY',
    name: '质检数量',
    type: 'number',
    status: '启用',
    category: '其他',
    required: true,
    isSystem: true,
    bizScopes: ['qc'],
    allowDecimal: true,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    placeholder: '请输入质检数量',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createQcLibraryField({
    id: 'qcf-sys-remark',
    code: 'QC_INSPECT_REMARK',
    name: '检验备注',
    type: 'textarea',
    status: '启用',
    category: '其他',
    required: false,
    isSystem: true,
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    placeholder: '请输入检验备注',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),

  createQcLibraryField({
    id: 'qcf-ph',
    code: 'QC_PH',
    name: 'pH值',
    type: 'number',
    status: '启用',
    category: '性能',
    required: true,
    allowDecimal: true,
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
    standardMin: 6.5,
    standardMax: 8.5,
    placeholder: '请输入pH',
    creator: '质检员A',
    createdAt: '2026-11-01 10:00:00',
    updater: '质检员A',
    updatedAt: '2026-11-01 10:00:00',
  }),
  createQcLibraryField({
    id: 'qcf-solid',
    code: 'QC_SOLID_CONTENT',
    name: '固含量',
    type: 'number',
    status: '启用',
    category: '材料',
    required: true,
    allowDecimal: true,
    withUnit: true,
    unit: '%',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
    standardMin: 20,
    standardMax: 35,
    placeholder: '请输入固含量',
    creator: '质检员A',
    createdAt: '2026-11-01 10:05:00',
    updater: '质检员A',
    updatedAt: '2026-11-01 10:05:00',
  }),
  createQcLibraryField({
    id: 'qcf-density',
    code: 'QC_DENSITY',
    name: '密度',
    type: 'number',
    status: '启用',
    category: '性能',
    required: true,
    allowDecimal: true,
    withUnit: true,
    unit: 'g/cm³',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
    standardMin: 1.0,
    standardMax: 1.3,
    placeholder: '请输入密度',
    creator: '质检员B',
    createdAt: '2026-11-01 10:10:00',
    updater: '质检员B',
    updatedAt: '2026-11-01 10:10:00',
  }),
  createQcLibraryField({
    id: 'qcf-filtrate',
    code: 'QC_FILTRATE_CLARITY',
    name: '滤液清澈度',
    type: 'radio',
    status: '启用',
    category: '外观',
    required: true,
    options: ['清澈', '微浊', '浑浊'],
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.OPTION_PASS,
    passOptions: ['清澈'],
    placeholder: '请选择滤液清澈度',
    creator: '质检员A',
    createdAt: '2026-11-01 10:15:00',
    updater: '质检员A',
    updatedAt: '2026-11-01 10:15:00',
  }),
  createQcLibraryField({
    id: 'qcf-moisture',
    code: 'QC_MOISTURE',
    name: '水分',
    type: 'number',
    status: '启用',
    category: '材料',
    required: true,
    allowDecimal: true,
    withUnit: true,
    unit: '%',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
    standardMax: 0.5,
    placeholder: '请输入水分',
    creator: '质检员B',
    createdAt: '2026-11-01 10:20:00',
    updater: '质检员B',
    updatedAt: '2026-11-01 10:20:00',
  }),
  createQcLibraryField({
    id: 'qcf-appearance-liq',
    code: 'QC_APPEARANCE',
    name: '外观检查',
    type: 'radio',
    status: '启用',
    category: '外观',
    required: true,
    options: ['合格', '不合格'],
    bizScopes: ['qc'],
    judgeRule: QC_FIELD_JUDGE_RULE.OPTION_PASS,
    passOptions: ['合格'],
    placeholder: '请选择外观',
    creator: '系统管理员',
    createdAt: '2026-11-01 10:25:00',
    updater: '系统管理员',
    updatedAt: '2026-11-01 10:25:00',
  }),
]

export function cloneQcLibraryFields() {
  return mockQcLibraryFields.map((f) =>
    createQcLibraryField({
      ...f,
      options: f.options ? [...f.options] : [],
      children: f.children,
      matrixColumns: f.matrixColumns,
      matrixRows: f.matrixRows,
    }),
  )
}

/** 按业务场景过滤检验项库（空 bizScopes = 通用） */
export function matchLibraryBizScope(field, scope) {
  if (!scope) return true
  const scopes = Array.isArray(field?.bizScopes) ? field.bizScopes : []
  if (!scopes.length) return true
  return scopes.includes(scope)
}

export function filterQcLibraryFields(list = [], filters = {}) {
  return (list || []).filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.category && row.category !== filters.category) return false
    if (filters.type && row.type !== filters.type) return false
    if (filters.code && !(row.code || '').includes(String(filters.code).trim())) return false
    if (filters.name && !(row.name || '').includes(String(filters.name).trim())) return false
    if (filters.creator && !(row.creator || '').includes(String(filters.creator).trim())) {
      return false
    }
    if (filters.bizScope && !matchLibraryBizScope(row, filters.bizScope)) return false
    if (filters.keyword) {
      const kw = String(filters.keyword).trim().toLowerCase()
      const hay = `${row.code || ''} ${row.name || ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    if (filters.dateRange?.length === 2) {
      const [start, end] = filters.dateRange
      const t = dayjs(row.createdAt)
      if (!t.isValid()) return false
      if (t.isBefore(dayjs(start).startOf('day')) || t.isAfter(dayjs(end).endOf('day'))) {
        return false
      }
    }
    return true
  })
}

export function nextQcLibraryFieldCode(list = []) {
  const nums = (list || [])
    .map((f) => {
      const m = String(f.code || '').match(/QC_FIELD_(\d+)/i)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `QC_FIELD_${String(next).padStart(3, '0')}`
}

/** 模板字段 → 库字段（排除系统项） */
export function templateFieldToLibraryPayload(field = {}) {
  if (isQcSystemFixedField(field)) return null
  const standard = pickFieldStandardProps(field)
  const complex = pickComplexFieldProps(field)
  return {
    code: field.code,
    name: field.name,
    type: field.type,
    required: Boolean(field.required),
    allowDecimal: Boolean(field.allowDecimal),
    description: field.description || '',
    placeholder: field.placeholder || '',
    options: field.options ? [...field.options] : [],
    optionRows: normalizeOptionRows(field),
    defaultValue: field.defaultValue ?? '',
    format: field.format || '',
    charLimit: field.charLimit ?? null,
    category: field.category || '其他',
    ...standard,
    ...complex,
    standardText:
      field.standardText ||
      (isComplexField(field)
        ? field.type === 'composite'
          ? '含子项分别判定'
          : '多点测点录入'
        : buildStandardText({ ...field, ...standard })),
  }
}

/** 库字段 → 模板字段快照 */
export function libraryFieldToTemplateField(lib = {}) {
  const code = String(lib.code || '')
    .trim()
    .toUpperCase()
  if (code === 'QC_CONCLUSION' || String(lib.name || '').trim() === '质检结果') {
    return createPresetConclusionField({
      name: lib.name || '质检结果',
      placeholder: lib.placeholder || '请选择质检结果',
      defaultValue: lib.defaultValue || '',
      options: lib.options,
      optionItems: lib.optionItems,
      optionResults: lib.optionResults,
      enabled: lib.status !== '停用',
    })
  }
  const standard = pickFieldStandardProps(lib)
  const complex = pickComplexFieldProps(lib)
  return {
    code: lib.code,
    name: lib.name,
    type: lib.type,
    required: Boolean(lib.required),
    allowDecimal: Boolean(lib.allowDecimal),
    description: lib.description || '',
    placeholder: lib.placeholder || '',
    options: lib.options ? [...lib.options] : [],
    optionRows: normalizeOptionRows(lib),
    defaultValue: lib.defaultValue ?? '',
    format: lib.format || '',
    charLimit: lib.charLimit ?? null,
    category: lib.category || '',
    isSystem: Boolean(lib.isSystem),
    valueSource:
      lib.valueSource === QC_FIELD_VALUE_SOURCE.SYSTEM
        ? QC_FIELD_VALUE_SOURCE.SYSTEM
        : QC_FIELD_VALUE_SOURCE.MANUAL,
    systemKey: String(lib.systemKey || '').trim(),
    bizScopes: Array.isArray(lib.bizScopes) ? [...lib.bizScopes] : [],
    ...standard,
    ...complex,
    standardText:
      lib.standardText ||
      (isComplexField(lib)
        ? lib.type === 'composite'
          ? '含子项分别判定'
          : '多点测点录入'
        : buildStandardText({ ...lib, ...standard })),
    isConclusion: false,
    isPresetConclusion: false,
    isSystemFixed: false,
    libraryFieldId: lib.id || '',
  }
}
