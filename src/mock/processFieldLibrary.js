/**
 * 工序采集指标库（与质检「检验项库」分离：不做合格判定）
 */
import dayjs from 'dayjs'
import {
  createQcLibraryField,
  QC_FIELD_VALUE_SOURCE,
  PROCESS_FORM_SYSTEM_KEYS,
  qcFieldLibraryBasicTypeOptions,
  qcFieldTypeLabel,
  fieldTypeTagColor,
} from '@/mock/qcFieldLibrary'
import { QC_FIELD_JUDGE_RULE, QC_UNIT_POSITION } from '@/utils/qcFieldStandard'

export {
  QC_FIELD_VALUE_SOURCE,
  PROCESS_FORM_SYSTEM_KEYS,
  qcFieldLibraryBasicTypeOptions,
  qcFieldTypeLabel,
  fieldTypeTagColor,
}

export const processFieldLibraryStatusOptions = ['启用', '停用']
/** 含复合项；过程采集不做合格判定 */
export const processFieldLibraryTypeOptions = [
  ...qcFieldLibraryBasicTypeOptions,
  { value: 'composite', label: '复合项（多子项）' },
]

export function createProcessLibraryField(partial = {}) {
  const children = Array.isArray(partial.children)
    ? partial.children.map((c) => ({
        ...c,
        judgeRule: QC_FIELD_JUDGE_RULE.NONE,
      }))
    : partial.children
  return createQcLibraryField({
    ...partial,
    children,
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    bizScopes: ['process'],
  })
}

export const mockProcessLibraryFields = [
  createProcessLibraryField({
    id: 'opf-sys-operator',
    code: 'OP_OPERATOR',
    name: '操作人',
    type: 'text',
    status: '启用',
    category: '执行',
    required: true,
    isSystem: true,
    valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
    systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATOR,
    placeholder: '系统自动带出当前登录人',
    description: '工序报工时取当前操作员',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createProcessLibraryField({
    id: 'opf-sys-time',
    code: 'OP_OPERATED_AT',
    name: '操作时间',
    type: 'datetime',
    status: '启用',
    category: '执行',
    required: true,
    isSystem: true,
    valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
    systemKey: PROCESS_FORM_SYSTEM_KEYS.OPERATED_AT,
    placeholder: '系统自动带出提交时间',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createProcessLibraryField({
    id: 'opf-sys-equipment',
    code: 'OP_EQUIPMENT',
    name: '本格设备',
    type: 'text',
    status: '启用',
    category: '执行',
    required: false,
    isSystem: true,
    valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
    systemKey: PROCESS_FORM_SYSTEM_KEYS.EQUIPMENT,
    placeholder: '系统带出本格挂接设备',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createProcessLibraryField({
    id: 'opf-sys-batch',
    code: 'OP_BATCH_NO',
    name: '批号',
    type: 'text',
    status: '启用',
    category: '执行',
    required: false,
    isSystem: true,
    valueSource: QC_FIELD_VALUE_SOURCE.SYSTEM,
    systemKey: PROCESS_FORM_SYSTEM_KEYS.BATCH_NO,
    placeholder: '系统带出批指令号',
    creator: '系统管理员',
    createdAt: '2026-01-01 00:00:00',
    updater: '系统管理员',
    updatedAt: '2026-01-01 00:00:00',
  }),
  createProcessLibraryField({
    id: 'opf-actual-feed',
    code: 'OP_ACTUAL_FEED',
    name: '实投量',
    type: 'number',
    status: '停用',
    category: '执行',
    required: false,
    allowDecimal: true,
    withUnit: true,
    unit: 'kg',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    placeholder: '已改由投料过账按明细填写，勿再放进过程记录模板',
    remark: '实投量/有效含量走投料明细过账并扣库存，过程记录模板不再采集',
    creator: '工艺员',
    createdAt: '2026-11-01 10:00:00',
    updater: '工艺员',
    updatedAt: '2026-11-17 18:00:00',
  }),
  createProcessLibraryField({
    id: 'opf-output-qty',
    code: 'OP_OUTPUT_QTY',
    name: '出料量',
    type: 'number',
    status: '启用',
    category: '执行',
    required: false,
    allowDecimal: true,
    withUnit: true,
    unit: 'kg',
    unitPosition: QC_UNIT_POSITION.SUFFIX,
    placeholder: '本步主流转出量，选填',
    remark: '过程记录用；正式多股落账走产出登记',
    creator: '工艺员',
    createdAt: '2026-11-01 10:05:00',
    updater: '工艺员',
    updatedAt: '2026-11-24 09:40:00',
  }),
  createProcessLibraryField({
    id: 'opf-remark',
    code: 'OP_REMARK',
    name: '操作备注',
    type: 'textarea',
    status: '启用',
    category: '执行',
    required: false,
    placeholder: '请输入操作备注',
    creator: '工艺员',
    createdAt: '2026-11-01 10:10:00',
    updater: '工艺员',
    updatedAt: '2026-11-01 10:10:00',
  }),
]

export function cloneProcessLibraryFields() {
  return mockProcessLibraryFields.map((f) =>
    createProcessLibraryField({
      ...f,
      options: f.options ? [...f.options] : [],
    }),
  )
}

export function filterProcessLibraryFields(list = [], filters = {}) {
  return (list || []).filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.type && row.type !== filters.type) return false
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

export function nextProcessLibraryFieldCode(list = []) {
  const nums = (list || [])
    .map((f) => {
      const m = String(f.code || '').match(/OP_FIELD_(\d+)/i)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `OP_FIELD_${String(next).padStart(3, '0')}`
}

export function processLibraryFieldToTemplateField(lib = {}) {
  return {
    code: lib.code,
    name: lib.name,
    type: lib.type || 'text',
    required: Boolean(lib.required),
    allowDecimal: Boolean(lib.allowDecimal),
    description: lib.description || '',
    placeholder: lib.placeholder || '',
    options: lib.options ? [...lib.options] : [],
    optionRows: Array.isArray(lib.optionRows) ? lib.optionRows.map((o) => ({ ...o })) : [],
    defaultValue: lib.defaultValue ?? '',
    category: lib.category || '执行',
    isSystem: Boolean(lib.isSystem),
    valueSource:
      lib.valueSource === QC_FIELD_VALUE_SOURCE.SYSTEM
        ? QC_FIELD_VALUE_SOURCE.SYSTEM
        : QC_FIELD_VALUE_SOURCE.MANUAL,
    systemKey: String(lib.systemKey || '').trim(),
    withUnit: Boolean(lib.withUnit),
    unit: lib.unit || '',
    unitPosition: lib.unitPosition || QC_UNIT_POSITION.SUFFIX,
    libraryFieldId: lib.id || '',
    judgeRule: QC_FIELD_JUDGE_RULE.NONE,
    children: Array.isArray(lib.children)
      ? lib.children.map((c) => ({
          ...c,
          options: c.options ? [...c.options] : [],
          judgeRule: QC_FIELD_JUDGE_RULE.NONE,
        }))
      : [],
  }
}

export function nowProcessFieldText() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss')
}
