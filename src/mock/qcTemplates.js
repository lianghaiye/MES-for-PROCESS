/**
 * 质检模板 mock / 筛选项
 */
import dayjs from 'dayjs'
import {
  cloneUniversalSystemTemplateFields,
  QC_SYSTEM_UNIVERSAL_BIZ_SCOPE,
  QC_SYSTEM_UNIVERSAL_TEMPLATE_CODE,
} from '@/mock/qcSystemTemplateFields'
import {
  ensureFieldsWithSystemFixedItems,
  createPresetConclusionField,
  createPresetInspectMethodField,
  createPresetInspectQtyField,
  createPresetInspectRemarkField,
  findQcConclusionField,
  normalizeSheetConclusionOptionItems,
  upsertSheetConclusionField,
} from '@/utils/qcConclusionField'
import {
  QC_FIELD_JUDGE_RULE,
  QC_UNIT_POSITION,
  buildStandardText,
  pickFieldStandardProps,
  createDefaultManualOptionItems,
} from '@/utils/qcFieldStandard'
import { pickComplexFieldProps } from '@/utils/qcComplexField'
import { QC_TEMPLATE_SHEET_PASS_RULE, normalizeSheetPassRule } from '@/utils/qcTemplateSheetPass'
import {
  isProcessInspectBizScope,
  normalizeTemplateProcessLinks,
} from '@/utils/qcTemplateProcessLink'

export const qcTemplateStatusOptions = ['启用', '停用']

export const qcTemplateTypeOptions = ['系统模板', '自定义模板']

/** 业务类型（内部取值；展示名见 qcBizScopeLabel） */
export const qcTemplateBizScopeOptions = [
  '成品检',
  '来料质检',
  '生产过程检',
  '外协回货检',
  '出厂质检',
]

/** 适用范围（对齐铭牌模板：全局 / 单产品 / 产品类别） */
export const QC_TEMPLATE_SCOPE_TYPE = {
  GLOBAL: 'global',
  SINGLE: 'single',
  CATEGORY: 'category',
}

export const qcTemplateScopeTypeOptions = [
  { value: QC_TEMPLATE_SCOPE_TYPE.GLOBAL, label: '全局' },
  { value: QC_TEMPLATE_SCOPE_TYPE.SINGLE, label: '单产品' },
  { value: QC_TEMPLATE_SCOPE_TYPE.CATEGORY, label: '产品类别' },
]

export function qcTemplateScopeTypeLabel(scopeType) {
  const hit = qcTemplateScopeTypeOptions.find((o) => o.value === scopeType)
  return hit?.label || '—'
}

export function createQcTemplate(partial = {}) {
  const rawFields = Array.isArray(partial.fields) ? partial.fields : []
  let fields = ensureFieldsWithSystemFixedItems(rawFields)
  const resolvedScopeType =
    partial.scopeType ||
    (Array.isArray(partial.objects) && partial.objects.length
      ? QC_TEMPLATE_SCOPE_TYPE.SINGLE
      : QC_TEMPLATE_SCOPE_TYPE.GLOBAL)
  const sheetPassRule = normalizeSheetPassRule(
    partial.sheetPassRule ?? QC_TEMPLATE_SHEET_PASS_RULE.MANUAL,
  )
  const sheetConclusionOptionItems = normalizeSheetConclusionOptionItems(
    partial.sheetConclusionOptionItems ?? findQcConclusionField(fields)?.optionItems,
  )
  fields = upsertSheetConclusionField(fields, sheetConclusionOptionItems)
  return {
    id: partial.id || `qct-${Date.now()}`,
    code: partial.code || '',
    name: partial.name || '',
    status: partial.status || '停用',
    type: partial.type || '自定义模板',
    isSystem: Boolean(partial.isSystem),
    isUniversal: Boolean(partial.isUniversal),
    bizScope: partial.bizScope || '成品检',
    objects: Array.isArray(partial.objects) ? partial.objects : [],
    creator: partial.creator || 'admin1',
    createdAt: partial.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    updater: partial.updater || partial.creator || 'admin1',
    updatedAt: partial.updatedAt || partial.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss'),
    ...partial,
    // 固定项规范化必须在 spread 之后，避免被 partial.fields 覆盖
    fields,
    fieldCount: fields.length,
    scopeType: resolvedScopeType,
    sheetPassRule,
    sheetConclusionOptionItems,
    /** 过程化验：投料前核对 / 中控取样 / 转序放行；其它业务类型为空 */
    assayType: isProcessInspectBizScope(partial.bizScope)
      ? String(partial.assayType || '').trim()
      : '',
    processLinks: isProcessInspectBizScope(partial.bizScope)
      ? normalizeTemplateProcessLinks(partial)
      : [],
  }
}

/** 将自定义检验项规范化为模板字段快照（不自动注入系统项） */
function mapCustomField(f = {}, idx = 0) {
  const standard = pickFieldStandardProps(f)
  const complex = pickComplexFieldProps(f)
  const row = {
    code: f.code,
    name: f.name,
    type: f.type || 'text',
    required: f.required !== false,
    options: f.options ? [...f.options] : [],
    allowDecimal: Boolean(f.allowDecimal),
    placeholder: f.placeholder || `请填写${f.name}`,
    sortOrder: f.sortOrder ?? 20 + idx,
    defaultValue: f.defaultValue ?? '',
    keyForSheetPass: Boolean(f.keyForSheetPass),
    ...standard,
    ...complex,
    passOptions: Array.isArray(f.passOptions) ? [...f.passOptions] : standard.passOptions,
    manualOptionItems: Array.isArray(f.manualOptionItems)
      ? f.manualOptionItems.map((o) => ({ ...o }))
      : standard.manualOptionItems,
    standardText: f.standardText || '',
  }
  if (row.judgeRule === QC_FIELD_JUDGE_RULE.MANUAL && !(row.manualOptionItems || []).length) {
    row.manualOptionItems = createDefaultManualOptionItems()
  }
  if (!row.standardText) {
    row.standardText =
      row.type === 'composite'
        ? '含子项分别判定'
        : row.type === 'matrix'
          ? '多点测点录入'
          : buildStandardText(row)
  }
  return row
}

/**
 * 按新规则组装模板字段：系统默认项（方式/数量/备注/结果）按需选用 + 自定义检验项。
 * 不再强制补齐缺失系统项。
 */
function buildTemplateFields({
  method = true,
  qty = true,
  remark = false,
  conclusion = true,
  methodDefault = '抽检',
  extras = [],
} = {}) {
  const list = []
  if (method) {
    list.push(createPresetInspectMethodField({ defaultValue: methodDefault, sortOrder: 1 }))
  }
  if (qty) {
    list.push(createPresetInspectQtyField({ sortOrder: 2 }))
  }
  ;(extras || []).forEach((f, idx) => {
    list.push(mapCustomField(f, idx))
  })
  if (remark) {
    list.push(createPresetInspectRemarkField({ sortOrder: 90 }))
  }
  if (conclusion) {
    list.push(createPresetConclusionField({ sortOrder: 99 }))
  }
  return ensureFieldsWithSystemFixedItems(list)
}

/** 全部达标 / 关键项：结论仅合格·不合格（默认合格），强调「先达标再选通过」 */
const SHEET_CONCLUSION_STRICT = [
  { value: '合格', result: '质检通过', locked: true, isDefault: true },
  { value: '不合格', result: '质检不通过', locked: true },
]

/** 人工判定：含让步/特采，文案与严格规则区分开，避免误以为「全部达标」 */
const SHEET_CONCLUSION_MANUAL_DEMO = [
  { value: '合格', result: '质检通过', locked: true, isDefault: true },
  { value: '不合格', result: '质检不通过', locked: true },
  { value: '特采放行', result: '质检通过', locked: false },
]

/** 新规则演示模板：字段由用户配置；系统项从检验项库选用 */
export const mockQcTemplates = [
  (() => {
    const fields = cloneUniversalSystemTemplateFields()
    return createQcTemplate({
      id: 'qct-sys-universal',
      code: QC_SYSTEM_UNIVERSAL_TEMPLATE_CODE,
      name: '系统通用模板',
      status: '启用',
      type: '系统模板',
      isSystem: true,
      isUniversal: true,
      scopeType: QC_TEMPLATE_SCOPE_TYPE.GLOBAL,
      bizScope: QC_SYSTEM_UNIVERSAL_BIZ_SCOPE,
      objects: [],
      fields,
      sheetPassRule: QC_TEMPLATE_SHEET_PASS_RULE.MANUAL,
      creator: '系统管理员',
      createdAt: '2026-01-15 10:30:00',
      updater: '系统管理员',
      updatedAt: '2026-11-01 09:00:00',
    })
  })(),
  (() => {
    const fields = buildTemplateFields({
      method: true,
      qty: true,
      remark: true,
      conclusion: true,
      extras: [
        {
          code: 'QC_PH',
          name: 'pH值',
          type: 'number',
          allowDecimal: true,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMin: 6.5,
          standardMax: 8.5,
          keyForSheetPass: true,
          sortOrder: 10,
        },
        {
          code: 'QC_SOLID_CONTENT',
          name: '固含量',
          type: 'number',
          allowDecimal: true,
          withUnit: true,
          unit: '%',
          unitPosition: QC_UNIT_POSITION.SUFFIX,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMin: 20,
          standardMax: 35,
          keyForSheetPass: true,
          sortOrder: 11,
        },
        {
          code: 'QC_APPEARANCE',
          name: '外观检查',
          type: 'radio',
          options: ['合格', '不合格'],
          judgeRule: QC_FIELD_JUDGE_RULE.OPTION_PASS,
          passOptions: ['合格'],
          sortOrder: 12,
        },
      ],
    })
    return createQcTemplate({
      id: 'qct-proc-fg',
      code: 'QCT-PROC-FG-001',
      name: '湿法成品检模板',
      status: '启用',
      type: '自定义模板',
      isSystem: false,
      scopeType: QC_TEMPLATE_SCOPE_TYPE.GLOBAL,
      bizScope: '成品检',
      objects: [],
      fields,
      sheetPassRule: QC_TEMPLATE_SHEET_PASS_RULE.KEY_FIELDS,
      sheetConclusionOptionItems: SHEET_CONCLUSION_STRICT.map((o) => ({ ...o })),
      creator: '质检员A',
      createdAt: '2026-11-01 10:00:00',
      updater: '质检员A',
      updatedAt: '2026-11-01 10:00:00',
    })
  })(),
  (() => {
    const fields = buildTemplateFields({
      method: true,
      qty: true,
      remark: true,
      conclusion: true,
      extras: [
        {
          code: 'QC_FILTRATE_CLARITY',
          name: '滤液清澈度',
          type: 'radio',
          options: ['清澈', '微浊', '浑浊'],
          judgeRule: QC_FIELD_JUDGE_RULE.OPTION_PASS,
          passOptions: ['清澈'],
          sortOrder: 10,
        },
        {
          code: 'QC_MOISTURE',
          name: '水分',
          type: 'number',
          allowDecimal: true,
          withUnit: true,
          unit: '%',
          unitPosition: QC_UNIT_POSITION.SUFFIX,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMax: 0.5,
          sortOrder: 11,
        },
      ],
    })
    return createQcTemplate({
      id: 'qct-proc-filter',
      code: 'QCT-PROC-SEP-001',
      name: '过滤过程检模板',
      status: '启用',
      type: '自定义模板',
      isSystem: false,
      scopeType: QC_TEMPLATE_SCOPE_TYPE.GLOBAL,
      bizScope: '生产过程检',
      assayType: 'in_process',
      objects: [],
      processNames: ['过滤'],
      fields,
      sheetPassRule: QC_TEMPLATE_SHEET_PASS_RULE.ALL_PASS,
      sheetConclusionOptionItems: SHEET_CONCLUSION_STRICT.map((o) => ({ ...o })),
      creator: '质检员A',
      createdAt: '2026-11-01 10:10:00',
      updater: '质检员A',
      updatedAt: '2026-11-01 10:10:00',
    })
  })(),
  (() => {
    const fields = buildTemplateFields({
      method: true,
      qty: true,
      remark: false,
      conclusion: true,
      extras: [
        {
          code: 'QC_DENSITY',
          name: '密度',
          type: 'number',
          allowDecimal: true,
          withUnit: true,
          unit: 'g/cm³',
          unitPosition: QC_UNIT_POSITION.SUFFIX,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMin: 1.0,
          standardMax: 1.3,
          sortOrder: 10,
        },
        {
          code: 'QC_PH',
          name: 'pH值',
          type: 'number',
          allowDecimal: true,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMin: 6.5,
          standardMax: 8.5,
          sortOrder: 11,
        },
      ],
    })
    return createQcTemplate({
      id: 'qct-proc-incoming',
      code: 'QCT-PROC-LL-001',
      name: '原料来料检模板',
      status: '启用',
      type: '自定义模板',
      isSystem: false,
      scopeType: QC_TEMPLATE_SCOPE_TYPE.GLOBAL,
      bizScope: '来料质检',
      objects: [],
      fields,
      sheetPassRule: QC_TEMPLATE_SHEET_PASS_RULE.MANUAL,
      sheetConclusionOptionItems: SHEET_CONCLUSION_MANUAL_DEMO.map((o) => ({ ...o })),
      creator: '质检员B',
      createdAt: '2026-11-01 10:20:00',
      updater: '质检员B',
      updatedAt: '2026-11-01 10:20:00',
    })
  })(),
  (() => {
    const fields = buildTemplateFields({
      method: true,
      qty: true,
      remark: true,
      conclusion: true,
      extras: [
        {
          code: 'QC_MOISTURE',
          name: '水分',
          type: 'number',
          allowDecimal: true,
          withUnit: true,
          unit: '%',
          unitPosition: QC_UNIT_POSITION.SUFFIX,
          judgeRule: QC_FIELD_JUDGE_RULE.RANGE,
          standardMax: 0.3,
          sortOrder: 10,
        },
        {
          code: 'QC_APPEARANCE',
          name: '外观检查',
          type: 'radio',
          options: ['合格', '不合格'],
          judgeRule: QC_FIELD_JUDGE_RULE.OPTION_PASS,
          passOptions: ['合格'],
          sortOrder: 11,
        },
      ],
    })
    return createQcTemplate({
      id: 'qct-proc-centrifuge',
      code: 'QCT-PROC-SEP-002',
      name: '离心过程检模板',
      status: '启用',
      type: '自定义模板',
      isSystem: false,
      scopeType: QC_TEMPLATE_SCOPE_TYPE.GLOBAL,
      bizScope: '生产过程检',
      assayType: 'in_process',
      objects: [],
      processNames: ['离心'],
      fields,
      sheetPassRule: QC_TEMPLATE_SHEET_PASS_RULE.ALL_PASS,
      sheetConclusionOptionItems: SHEET_CONCLUSION_STRICT.map((o) => ({ ...o })),
      creator: '质检员A',
      createdAt: '2026-11-01 10:30:00',
      updater: '质检员A',
      updatedAt: '2026-11-01 10:30:00',
    })
  })(),
]

export function cloneQcTemplates() {
  return mockQcTemplates.map((t) => {
    const fields = ensureFieldsWithSystemFixedItems(
      Array.isArray(t.fields)
        ? t.fields.map((f) => ({
            ...f,
            options: f.options ? [...f.options] : [],
            optionItems: f.optionItems ? f.optionItems.map((o) => ({ ...o })) : undefined,
            optionResults: f.optionResults ? { ...f.optionResults } : undefined,
            children: Array.isArray(f.children) ? f.children.map((c) => ({ ...c })) : [],
            matrixColumns: Array.isArray(f.matrixColumns)
              ? f.matrixColumns.map((c) => ({ ...c }))
              : [],
            matrixRows: Array.isArray(f.matrixRows) ? f.matrixRows.map((r) => ({ ...r })) : [],
            matrixAllowAddRow: f.matrixAllowAddRow,
          }))
        : [],
    )
    return {
      ...t,
      objects: [...(t.objects || [])],
      processLinks: normalizeTemplateProcessLinks(t),
      fields,
      fieldCount: fields.length,
      sheetConclusionOptionItems: Array.isArray(t.sheetConclusionOptionItems)
        ? t.sheetConclusionOptionItems.map((o) => ({ ...o }))
        : undefined,
    }
  })
}

export function filterQcTemplates(list = [], filters = {}) {
  return (list || []).filter((row) => {
    if (filters.status && row.status !== filters.status) return false
    if (filters.type && row.type !== filters.type) return false
    if (filters.bizScope) {
      const scope = String(filters.bizScope).trim()
      const isUniversal =
        row.isSystem && (row.isUniversal || row.bizScope === '通用' || row.code === 'QCT-SYS-001')
      if (!isUniversal && row.bizScope !== scope) return false
    }
    if (filters.scopeType && row.scopeType !== filters.scopeType) return false
    if (filters.code && !(row.code || '').includes(String(filters.code).trim())) return false
    if (filters.name && !(row.name || '').includes(String(filters.name).trim())) return false
    if (filters.creator && !(row.creator || '').includes(String(filters.creator).trim())) {
      return false
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

function scopeSortRank(scopeType) {
  if (scopeType === QC_TEMPLATE_SCOPE_TYPE.SINGLE) return 3
  if (scopeType === QC_TEMPLATE_SCOPE_TYPE.CATEGORY) return 2
  if (scopeType === QC_TEMPLATE_SCOPE_TYPE.GLOBAL) return 1
  return 0
}

/** 生效视图排序：业务类型 → 适用范围（单产品>类别>全局）→ 更新时间倒序 */
export function sortQcTemplatesForBrowse(list = []) {
  return (list || []).slice().sort((a, b) => {
    const bizA = String(a.isUniversal || a.bizScope === '通用' ? '通用' : a.bizScope || '')
    const bizB = String(b.isUniversal || b.bizScope === '通用' ? '通用' : b.bizScope || '')
    if (bizA !== bizB) return bizA.localeCompare(bizB, 'zh-CN')
    const scopeDiff = scopeSortRank(b.scopeType) - scopeSortRank(a.scopeType)
    if (scopeDiff !== 0) return scopeDiff
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  })
}

/** 列表展示适用对象摘要 */
export function formatQcTemplateObjects(template = {}) {
  if (template.isUniversal || template.bizScope === '通用' || template.code === 'QCT-SYS-001') {
    return '全业务兜底'
  }
  const scopeType = template.scopeType || QC_TEMPLATE_SCOPE_TYPE.GLOBAL
  if (scopeType === QC_TEMPLATE_SCOPE_TYPE.GLOBAL) return '全部'
  const objects = Array.isArray(template.objects) ? template.objects : []
  if (!objects.length) return '—'
  const labels = objects
    .map((o) => o.label || o.code || o.value || o.name)
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  if (!labels.length) return '—'
  if (labels.length <= 2) return labels.join('、')
  return `${labels.slice(0, 2).join('、')} 等${labels.length}项`
}

export function nextQcTemplateCode(list = []) {
  const nums = (list || [])
    .map((t) => {
      const m = String(t.code || '').match(/QCT-USR-(\d+)/i)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `QCT-USR-${String(next).padStart(3, '0')}`
}
