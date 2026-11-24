import { reactive, watch } from 'vue'
import dayjs from 'dayjs'

const STORAGE_KEY = 'i_doms_coding_rules_v2'
const SEQ_STORAGE_KEY = 'i_doms_coding_rule_seq_v1'
const SEED_VERSION_KEY = 'i_doms_coding_rules_seed_v'
const CURRENT_SEED_VERSION = '2'

export const RULE_STATUS = {
  ENABLED: '启用',
  DISABLED: '禁用',
}

/** 段落规则类型 */
export const SEGMENT_TYPE = {
  CONSTANT: 'constant',
  DATE: 'date',
  SERIAL: 'serial',
  BIZ_FIELD: 'bizField',
  INPUT: 'input',
}

export const SEGMENT_TYPE_OPTIONS = [
  { label: '常量', value: SEGMENT_TYPE.CONSTANT },
  { label: '日期', value: SEGMENT_TYPE.DATE },
  { label: '流水号', value: SEGMENT_TYPE.SERIAL },
  { label: '业务字段', value: SEGMENT_TYPE.BIZ_FIELD },
  { label: '传入字符串', value: SEGMENT_TYPE.INPUT },
]

export const SEGMENT_TYPE_LABEL = Object.fromEntries(
  SEGMENT_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const DATE_FORMAT_OPTIONS = [
  { label: 'yyyyMMdd', value: 'yyyyMMdd' },
  { label: 'yyyyMM', value: 'yyyyMM' },
  { label: 'yyyy', value: 'yyyy' },
  { label: 'yyMMdd', value: 'yyMMdd' },
  { label: 'yyMM', value: 'yyMM' },
]

/** 表单用哨兵：无分隔符存库仍为空串 */
export const SEPARATOR_NONE = '__none__'

export const SEPARATOR_OPTIONS = [
  { label: '-', value: '-' },
  { label: '_', value: '_' },
  { label: '无分隔符', value: SEPARATOR_NONE },
  { label: '.', value: '.' },
  { label: '/', value: '/' },
]

export function toSeparatorFormValue(sep) {
  return sep === '' || sep == null ? SEPARATOR_NONE : String(sep)
}

export function fromSeparatorFormValue(val) {
  return val === SEPARATOR_NONE ? '' : val == null ? '-' : String(val)
}

export const SEGMENT_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({
  label: String(n),
  value: n,
}))

export const SERIAL_RESET_OPTIONS = [
  { label: '不重置', value: 'never' },
  { label: '按日重置', value: 'day' },
  { label: '按月重置', value: 'month' },
  { label: '按年重置', value: 'year' },
]

/** 所属业务（单据/主数据编码场景） */
export const BUSINESS_OPTIONS = [
  { label: '销售管理-销售订单', value: 'sales_order' },
  { label: '销售管理-发货单', value: 'delivery_order' },
  { label: '采购管理-采购申请', value: 'purchase_req' },
  { label: '采购管理-采购订单', value: 'purchase_order' },
  { label: '库存管理-入库单', value: 'inbound_order' },
  { label: '库存管理-出库单', value: 'outbound_order' },
  { label: '生产管理-生产工单', value: 'work_order' },
  { label: '生产管理-批次指令', value: 'batch_instruction' },
  { label: '生产管理-返工单', value: 'rework_order' },
  { label: '质量管理-质检单', value: 'qc_task' },
  { label: '质量管理-报废单', value: 'scrap_order' },
  { label: '物品管理-产品物料编码', value: 'material_code' },
  { label: '工艺管理-配方', value: 'formula' },
]

export const BUSINESS_LABEL = Object.fromEntries(BUSINESS_OPTIONS.map((o) => [o.value, o.label]))

export function resolveRuleName(name, business) {
  const trimmed = String(name || '').trim()
  if (trimmed) return trimmed
  return BUSINESS_LABEL[business] || '未命名规则'
}

function formatDateByPattern(pattern, at = dayjs()) {
  const d = dayjs(at)
  const map = {
    yyyyMMdd: 'YYYYMMDD',
    yyyyMM: 'YYYYMM',
    yyyy: 'YYYY',
    yyMMdd: 'YYMMDD',
    yyMM: 'YYMM',
  }
  return d.format(map[pattern] || 'YYYYMMDD')
}

function resetKey(cycle, at = dayjs()) {
  const d = dayjs(at)
  if (cycle === 'day') return d.format('YYYYMMDD')
  if (cycle === 'month') return d.format('YYYYMM')
  if (cycle === 'year') return d.format('YYYY')
  return 'all'
}

function createSegment(partial = {}, index = 0) {
  const type = partial.type || SEGMENT_TYPE.CONSTANT
  return {
    id: partial.id || `seg-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    value: partial.value ?? '',
    dateFormat: partial.dateFormat || 'yyyyMMdd',
    serialLength: Number.isFinite(Number(partial.serialLength))
      ? Math.min(12, Math.max(1, Number(partial.serialLength)))
      : 4,
    serialStart: Number.isFinite(Number(partial.serialStart))
      ? Math.max(0, Number(partial.serialStart))
      : 1,
    serialReset: partial.serialReset || 'month',
    fieldKey: partial.fieldKey || '',
    paramKey: partial.paramKey || '',
  }
}

function normalizeRule(row) {
  const segments = Array.isArray(row.segments)
    ? row.segments.map((s, i) => createSegment(s, i))
    : []
  const segmentCount = Number(row.segmentCount) || segments.length || 1
  while (segments.length < segmentCount) {
    segments.push(createSegment({}, segments.length))
  }
  const business = String(row.business || '').trim()
  return {
    id: row.id,
    name: resolveRuleName(row.name, business),
    code: String(row.code || '').trim(),
    business,
    segmentCount,
    separator: row.separator === undefined || row.separator === null ? '-' : String(row.separator),
    status: row.status === RULE_STATUS.DISABLED ? RULE_STATUS.DISABLED : RULE_STATUS.ENABLED,
    remark: String(row.remark || '').trim(),
    segments: segments.slice(0, segmentCount),
    builtin: Boolean(row.builtin),
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    creator: row.creator || 'admin',
  }
}

function seedRules() {
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const rows = [
    {
      id: 'cr-sales-order',
      code: 'AUTO_SALES_ORDER',
      name: '销售订单默认规则',
      business: 'sales_order',
      segmentCount: 3,
      separator: '',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'XSDD' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMM' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 4,
          serialStart: 1,
          serialReset: 'month',
        },
      ],
    },
    {
      id: 'cr-purchase-order',
      code: 'AUTO_PURCHASE_ORDER',
      name: '采购订单默认规则',
      business: 'purchase_order',
      segmentCount: 3,
      separator: '',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'CG' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 3,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
    {
      id: 'cr-inbound',
      code: 'AUTO_INBOUND',
      name: '入库单默认规则',
      business: 'inbound_order',
      segmentCount: 3,
      separator: '-',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: '1' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 5,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
    {
      id: 'cr-outbound',
      code: 'AUTO_OUTBOUND',
      name: '出库单默认规则',
      business: 'outbound_order',
      segmentCount: 3,
      separator: '',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'OUT' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 4,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
    {
      id: 'cr-qc-task',
      code: 'AUTO_QC_TASK',
      name: '质检单默认规则',
      business: 'qc_task',
      segmentCount: 3,
      separator: '-',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'ZJ' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 4,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
    {
      id: 'cr-rework',
      code: 'AUTO_1071',
      name: '生产管理-返工单默认规则',
      business: 'rework_order',
      segmentCount: 3,
      separator: '-',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'FG' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 3,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
    {
      id: 'cr-material',
      code: 'bmlb',
      name: '测试编码类别',
      business: 'material_code',
      segmentCount: 2,
      separator: '-',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'MAT' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 5,
          serialStart: 1,
          serialReset: 'never',
        },
      ],
    },
    {
      id: 'cr-formula',
      code: 'AUTO_FORMULA',
      name: '工艺管理-配方',
      business: 'formula',
      segmentCount: 3,
      separator: '-',
      segments: [
        { type: SEGMENT_TYPE.CONSTANT, value: 'PF' },
        { type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' },
        {
          type: SEGMENT_TYPE.SERIAL,
          serialLength: 3,
          serialStart: 1,
          serialReset: 'day',
        },
      ],
    },
  ]
  return rows.map((r) =>
    normalizeRule({
      ...r,
      status: RULE_STATUS.ENABLED,
      builtin: true,
      remark: '',
      creator: 'admin',
      createdAt: now,
      updatedAt: now,
    }),
  )
}

function loadFromStorage() {
  try {
    if (localStorage.getItem(SEED_VERSION_KEY) !== CURRENT_SEED_VERSION) return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.rules) && parsed.rules.length) {
      return parsed.rules.map(normalizeRule)
    }
  } catch {
    /* ignore */
  }
  return null
}

function loadSeqMap() {
  try {
    const raw = localStorage.getItem(SEQ_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistRules() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ rules: codingRuleState.rules }))
  localStorage.setItem(SEED_VERSION_KEY, CURRENT_SEED_VERSION)
}

function persistSeq() {
  localStorage.setItem(SEQ_STORAGE_KEY, JSON.stringify(codingRuleState.seqMap))
}

export const codingRuleState = reactive({
  rules: loadFromStorage() || seedRules(),
  seqMap: loadSeqMap(),
})

watch(
  () => codingRuleState.rules,
  () => persistRules(),
  { deep: true },
)

watch(
  () => codingRuleState.seqMap,
  () => persistSeq(),
  { deep: true },
)

let ruleSeq = codingRuleState.rules.length
/** 规则编码自增序号（AUTO_xxxx） */
let autoCodeSeq = 1000 + codingRuleState.rules.length

export function nextAutoRuleCode() {
  autoCodeSeq += 1
  let code = `AUTO_${autoCodeSeq}`
  while (codingRuleState.rules.some((r) => r.code === code)) {
    autoCodeSeq += 1
    code = `AUTO_${autoCodeSeq}`
  }
  return code
}

export function resolveRuleCode(code) {
  const trimmed = String(code || '').trim()
  if (trimmed) return trimmed
  return nextAutoRuleCode()
}

export function listCodingRules(filters = {}) {
  void codingRuleState.rules
  const name = String(filters.name || '')
    .trim()
    .toLowerCase()
  const business = filters.business
  const status = filters.status
  return [...codingRuleState.rules]
    .filter((r) => {
      if (business && r.business !== business) return false
      if (status && r.status !== status) return false
      if (name) {
        const hay = `${r.name} ${r.code}`.toLowerCase()
        if (!hay.includes(name)) return false
      }
      return true
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export function getCodingRuleById(id) {
  return codingRuleState.rules.find((r) => r.id === id) || null
}

export function getEnabledRuleByBusiness(business) {
  return (
    codingRuleState.rules.find(
      (r) => r.business === business && r.status === RULE_STATUS.ENABLED,
    ) || null
  )
}

function nextSerial(ruleId, segment, at = dayjs()) {
  const period = resetKey(segment.serialReset, at)
  const key = `${ruleId}::${segment.id || 'serial'}::${period}`
  const start = Number(segment.serialStart) || 1
  const current = codingRuleState.seqMap[key]
  const next = Number.isFinite(Number(current)) ? Number(current) + 1 : start
  codingRuleState.seqMap[key] = next
  const len = Number(segment.serialLength) || 4
  return String(next).padStart(len, '0')
}

function resolveSegmentValue(segment, ctx = {}) {
  const at = ctx.at || dayjs()
  switch (segment.type) {
    case SEGMENT_TYPE.CONSTANT:
      return String(segment.value || '')
    case SEGMENT_TYPE.DATE:
      return formatDateByPattern(segment.dateFormat, at)
    case SEGMENT_TYPE.SERIAL:
      return nextSerial(ctx.ruleId, segment, at)
    case SEGMENT_TYPE.BIZ_FIELD: {
      const key = segment.fieldKey
      const val = key ? ctx.fields?.[key] : ''
      return val == null ? '' : String(val)
    }
    case SEGMENT_TYPE.INPUT: {
      const key = segment.paramKey
      const val = key ? ctx.params?.[key] : ctx.input
      return val == null ? '' : String(val)
    }
    default:
      return ''
  }
}

/** 按规则生成编码；无启用规则时返回 null */
export function generateCodeByRule(rule, context = {}) {
  if (!rule || rule.status !== RULE_STATUS.ENABLED) return null
  const parts = (rule.segments || []).map((seg) =>
    resolveSegmentValue(seg, { ...context, ruleId: rule.id }),
  )
  const sep = rule.separator == null ? '-' : String(rule.separator)
  return parts.join(sep)
}

/** 按所属业务取启用规则并生成编码 */
export function generateCodeByBusiness(business, context = {}) {
  const rule = getEnabledRuleByBusiness(business)
  if (!rule) return null
  return generateCodeByRule(rule, context)
}

/**
 * 预览后续 N 个业务编码（只读模拟流水，不占用、不落库）。
 * 用于表单预填；提交时仍把预填号当自定义号写入。
 */
export function peekCodesByBusiness(business, count = 1, context = {}) {
  const n = Math.max(0, Math.min(500, Number(count) || 0))
  if (!n) return []
  const rule = getEnabledRuleByBusiness(business)
  if (!rule) return []
  const at = context.at || dayjs()
  const seqView = { ...codingRuleState.seqMap }
  const sep = rule.separator == null ? '-' : String(rule.separator)
  const codes = []
  for (let i = 0; i < n; i += 1) {
    const parts = (rule.segments || []).map((seg) => {
      if (seg.type !== SEGMENT_TYPE.SERIAL) {
        return resolveSegmentValue(seg, { ...context, at, ruleId: rule.id })
      }
      const period = resetKey(seg.serialReset, at)
      const key = `${rule.id}::${seg.id || 'serial'}::${period}`
      const start = Number(seg.serialStart) || 1
      const current = seqView[key]
      const next = Number.isFinite(Number(current)) ? Number(current) + 1 : start
      seqView[key] = next
      const len = Number(seg.serialLength) || 4
      return String(next).padStart(len, '0')
    })
    codes.push(parts.join(sep))
  }
  return codes
}

/** 预览编码（不消耗流水号） */
export function previewCodeByRule(rule, context = {}) {
  if (!rule) return ''
  const at = context.at || dayjs()
  const parts = (rule.segments || []).map((seg) => {
    if (seg.type === SEGMENT_TYPE.SERIAL) {
      const len = Number(seg.serialLength) || 4
      const start = Number(seg.serialStart) || 1
      return String(start).padStart(len, '0')
    }
    if (seg.type === SEGMENT_TYPE.CONSTANT) return String(seg.value || '')
    if (seg.type === SEGMENT_TYPE.DATE) return formatDateByPattern(seg.dateFormat, at)
    if (seg.type === SEGMENT_TYPE.BIZ_FIELD) {
      const key = seg.fieldKey
      return key && context.fields?.[key] != null
        ? String(context.fields[key])
        : `{${key || '字段'}}`
    }
    if (seg.type === SEGMENT_TYPE.INPUT) {
      const key = seg.paramKey
      return key && context.params?.[key] != null
        ? String(context.params[key])
        : `{${key || '传入'}}`
    }
    return ''
  })
  const sep = rule.separator == null ? '-' : String(rule.separator)
  return parts.join(sep)
}

function validatePayload(payload, excludeId) {
  const code = String(payload.code || '').trim()
  const business = String(payload.business || '').trim()
  if (code && code.length > 30) return { ok: false, message: '规则编码最多 30 个字符' }
  if (!business) return { ok: false, message: '请选择所属业务' }
  if (!BUSINESS_LABEL[business]) return { ok: false, message: '所属业务无效' }
  const segmentCount = Number(payload.segmentCount)
  if (!Number.isFinite(segmentCount) || segmentCount < 1 || segmentCount > 6) {
    return { ok: false, message: '段落数须为 1~6' }
  }
  const segments = Array.isArray(payload.segments) ? payload.segments : []
  if (segments.length !== segmentCount) {
    return { ok: false, message: '段落配置与段落数不一致' }
  }
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i]
    if (!SEGMENT_TYPE_LABEL[seg.type]) {
      return { ok: false, message: `第 ${i + 1} 段：请选择规则类型` }
    }
    if (seg.type === SEGMENT_TYPE.CONSTANT && !String(seg.value || '').trim()) {
      return { ok: false, message: `第 ${i + 1} 段：请填写常量设置值` }
    }
    if (seg.type === SEGMENT_TYPE.DATE && !seg.dateFormat) {
      return { ok: false, message: `第 ${i + 1} 段：请选择日期格式` }
    }
    if (seg.type === SEGMENT_TYPE.SERIAL) {
      const len = Number(seg.serialLength)
      if (!Number.isFinite(len) || len < 1 || len > 12) {
        return { ok: false, message: `第 ${i + 1} 段：流水号长度须为 1~12` }
      }
    }
    if (seg.type === SEGMENT_TYPE.BIZ_FIELD && !String(seg.fieldKey || '').trim()) {
      return { ok: false, message: `第 ${i + 1} 段：请填写业务字段` }
    }
    if (seg.type === SEGMENT_TYPE.INPUT && !String(seg.paramKey || '').trim()) {
      return { ok: false, message: `第 ${i + 1} 段：请填写传入参数名` }
    }
  }
  if (code) {
    const dupCode = codingRuleState.rules.find(
      (r) => r.id !== excludeId && r.code.toLowerCase() === code.toLowerCase(),
    )
    if (dupCode) return { ok: false, message: '规则编码已存在' }
  }
  const enabledConflict = codingRuleState.rules.find(
    (r) =>
      r.id !== excludeId &&
      r.business === business &&
      (payload.status || RULE_STATUS.ENABLED) === RULE_STATUS.ENABLED &&
      r.status === RULE_STATUS.ENABLED,
  )
  if (enabledConflict && (payload.status || RULE_STATUS.ENABLED) === RULE_STATUS.ENABLED) {
    return {
      ok: false,
      message: `「${BUSINESS_LABEL[business]}」已有启用规则「${enabledConflict.name}」`,
    }
  }
  if (payload.remark && String(payload.remark).length > 200) {
    return { ok: false, message: '备注最多 200 个字符' }
  }
  return { ok: true }
}

export function addCodingRule(payload) {
  const check = validatePayload(payload)
  if (!check.ok) return check
  ruleSeq += 1
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const business = String(payload.business || '').trim()
  const rule = normalizeRule({
    ...payload,
    id: `cr-${Date.now()}-${ruleSeq}`,
    name: resolveRuleName(payload.name, business),
    code: resolveRuleCode(payload.code),
    business,
    builtin: false,
    creator: 'admin',
    createdAt: now,
    updatedAt: now,
  })
  codingRuleState.rules.unshift(rule)
  return { ok: true, data: rule }
}

export function updateCodingRule(id, payload) {
  const idx = codingRuleState.rules.findIndex((r) => r.id === id)
  if (idx === -1) return { ok: false, message: '规则不存在' }
  const check = validatePayload(payload, id)
  if (!check.ok) return check
  const prev = codingRuleState.rules[idx]
  const now = dayjs().format('YYYY-MM-DD HH:mm')
  const business = String(payload.business || '').trim()
  codingRuleState.rules[idx] = normalizeRule({
    ...prev,
    ...payload,
    id: prev.id,
    name: resolveRuleName(payload.name, business),
    code: String(payload.code || '').trim() || prev.code,
    business,
    builtin: prev.builtin,
    creator: prev.creator,
    createdAt: prev.createdAt,
    updatedAt: now,
  })
  return { ok: true, data: codingRuleState.rules[idx] }
}

export function deleteCodingRule(id) {
  const idx = codingRuleState.rules.findIndex((r) => r.id === id)
  if (idx === -1) return { ok: false, message: '规则不存在' }
  codingRuleState.rules.splice(idx, 1)
  return { ok: true }
}

export function deleteCodingRules(ids = []) {
  const set = new Set(ids)
  const before = codingRuleState.rules.length
  codingRuleState.rules = codingRuleState.rules.filter((r) => !set.has(r.id))
  return { ok: true, deleted: before - codingRuleState.rules.length }
}

export function createEmptySegments(count) {
  const n = Math.min(6, Math.max(1, Number(count) || 1))
  return Array.from({ length: n }, (_, i) => {
    if (i === 0) return createSegment({ type: SEGMENT_TYPE.CONSTANT, value: '' }, i)
    if (i === 1) return createSegment({ type: SEGMENT_TYPE.DATE, dateFormat: 'yyyyMMdd' }, i)
    return createSegment(
      {
        type: SEGMENT_TYPE.SERIAL,
        serialLength: 4,
        serialStart: 1,
        serialReset: 'month',
      },
      i,
    )
  })
}
