/** 工序操作开关定义（控制工单任务可操作内容） */
export const PROCESS_OPERATION_DEFS = [
  { key: 'opStart', label: '开工' },
  { key: 'opAutoStart', label: '自动开工' },
  { key: 'opFinish', label: '完工' },
  { key: 'opAutoFinish', label: '自动完工' },
  { key: 'opFeeding', label: '投料' },
  { key: 'opScrap', label: '报废' },
  { key: 'opInbound', label: '入库' },
  { key: 'opProductInbound', label: '制品入库' },
  { key: 'opProductOutbound', label: '制品出库' },
  { key: 'opQc', label: '质检' },
  { key: 'opAttachment', label: '附件上传' },
  { key: 'opAttrModify', label: '属性修改' },
  { key: 'opOutsource', label: '外协' },
  { key: 'opAutoDistribute', label: '自动分发' },
  { key: 'opDisassembly', label: '拆解' },
  { key: 'opDisassemblyQc', label: '拆解质检' },
]

/** 流程型工序只挂岗位，不再用班组/工人个人 */
export const RESOURCE_TYPES = ['岗位']

export const MOCK_POSITIONS = ['配料岗', '反应岗', '分离岗', '灌装岗', '储运岗', '质检岗']

function defaultOperations(overrides = {}) {
  const base = Object.fromEntries(PROCESS_OPERATION_DEFS.map((d) => [d.key, false]))
  return { ...base, ...overrides }
}

function padCode(n) {
  return `GX${String(n).padStart(8, '0')}`
}

/** 工序默认执行：只挂岗位（与基础配置岗位主数据对齐），用来把步骤分到对应终端。 */
export const PROCESS_RESPONSIBLE_OPTIONS = [
  { type: 'position', name: '配料岗' },
  { type: 'position', name: '反应岗' },
  { type: 'position', name: '分离岗' },
  { type: 'position', name: '灌装岗' },
]

export function responsibleKey(type, name) {
  if (!name) return ''
  return `${type === 'group' ? 'group' : 'position'}:${name}`
}

export function parseResponsibleKey(key) {
  const text = String(key || '')
  const index = text.indexOf(':')
  if (index < 0) return { type: 'position', name: '' }
  const type = text.slice(0, index) === 'group' ? 'group' : 'position'
  return { type, name: text.slice(index + 1) }
}

export const PROCESS_GATE_RECORD = 'record'
export const PROCESS_GATE_HARD = 'hard'
export const PROCESS_GATE_INHERIT = 'inherit'
export const PROCESS_GATE_OPTIONS = [
  { value: PROCESS_GATE_RECORD, label: '记录 · 技术员判定' },
  { value: PROCESS_GATE_HARD, label: '硬门禁 · 系统自动卡' },
]

export function normalizeProcessGate(value) {
  return value === PROCESS_GATE_HARD ? PROCESS_GATE_HARD : PROCESS_GATE_RECORD
}

export function formatProcessGate(value) {
  return normalizeProcessGate(value) === PROCESS_GATE_HARD
    ? '硬门禁 · 系统自动卡'
    : '记录 · 技术员判定'
}

export function isCustomRouteGate(cell) {
  return cell?.gateMode === PROCESS_GATE_RECORD || cell?.gateMode === PROCESS_GATE_HARD
}

export function resolveRouteGate(process, cell) {
  if (isCustomRouteGate(cell)) return cell.gateMode
  return normalizeProcessGate(process?.gateMode)
}

export function resolveRouteTransfer(process, cell) {
  if (cell?.transferCustom) return cell.transferCondition || ''
  return process?.transferCondition || ''
}

export function formatProcessResponsible(process) {
  const list =
    Array.isArray(process?.defaultExecutors) && process.defaultExecutors.length
      ? process.defaultExecutors
      : process?.responsibleName
        ? [process.responsibleName]
        : []
  return list
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .join('、')
}

export const REPORT_MODES = ['批量计件', '时长报工']

export const TASK_EXECUTION_MODES = [
  { value: 'single_claim', label: '单人领工' },
  { value: 'collaborative', label: '多人协作' },
]

/** 稳定设备 id，与 equipmentSeed 对齐 */
const EQ = {
  R101: 'eq-d-1',
  R201: 'eq-d-2',
  F301: 'eq-d-3',
  C401: 'eq-d-4',
  T501: 'eq-d-5',
  T601: 'eq-d-6',
  P701: 'eq-d-7',
}

/** 流程型单元操作名录 */
export function createProcessConfigSeed() {
  const defs = [
    {
      category: '配料',
      name: '投料',
      instruction: '按配方称取原料，核对批号后投入指定设备。',
      gateMode: 'record',
      transferCondition: '投料完成后可进入下一步',
      responsibleType: 'position',
      responsibleName: '配料岗',
      equipmentIds: [EQ.R101, EQ.R201],
      formTemplateId: 'pft-feed',
      operations: { opFeeding: true, opStart: true, opFinish: true },
      qcConfigs: [
        {
          id: 'pqc-feed-check',
          bizScope: '生产过程检',
          assayType: 'feed_check',
          gateMode: 'record',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '反应',
      name: '升温',
      instruction: '按设定温度升温，记录实际温度。',
      params: [{ name: '温度', unit: '℃', target: null, min: null, max: null }],
      gateMode: 'record',
      transferCondition: '温度记录完成后可进入下一步',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opStart: true, opFinish: true, opAttachment: true },
    },
    {
      category: '反应',
      name: '保温',
      instruction: '维持温度至规定时间，记录温度和时间。',
      params: [
        { name: '温度', unit: '℃', target: 80, min: 75, max: 85 },
        { name: '时间', unit: 'min', target: 30, min: 25, max: 40 },
        { name: '转速', unit: 'rpm', target: 60, min: 40, max: 80 },
      ],
      gateMode: 'record',
      transferCondition: '保温时间到达后可进入下一步',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opStart: true, opFinish: true, opAttachment: true },
      qcConfigs: [
        {
          id: 'pqc-hold-monitor',
          bizScope: '生产过程检',
          assayType: 'in_process',
          gateMode: 'record',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '分离',
      name: '过滤',
      instruction: '固液分离，滤液和滤渣分别收集。',
      gateMode: 'hard',
      transferCondition: '滤液和滤渣都收集完成后可放行',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-filter-monitor',
          bizScope: '生产过程检',
          assayType: 'in_process',
          gateMode: 'record',
          allowMultiple: true,
        },
        {
          id: 'pqc-filter-release',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '分离',
      name: '离心',
      instruction: '按设定转速分离，记录出料。',
      params: [
        { name: '转速', unit: 'rpm', target: null, min: null, max: null },
        { name: '时间', unit: 'min', target: null, min: null, max: null },
      ],
      gateMode: 'hard',
      transferCondition: '分离完成并核对出料后可放行',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.C401],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-centrifuge-release',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '灌装',
      name: '灌装',
      instruction: '按包装规格灌装并核对重量。',
      gateMode: 'hard',
      transferCondition: '灌装重量核对通过后可放行',
      responsibleType: 'position',
      responsibleName: '灌装岗',
      equipmentIds: [EQ.P701],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true, opInbound: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-fill-fg',
          bizScope: '成品检',
          assayType: 'finished',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '储运',
      name: '转罐',
      instruction: '从源罐转入目标罐，核对数量。',
      gateMode: 'hard',
      transferCondition: '转入数量核对通过后可放行',
      responsibleType: 'position',
      responsibleName: '配料岗',
      equipmentIds: [EQ.T501, EQ.T601],
      formTemplateId: '',
      operations: {
        opStart: true,
        opFinish: true,
        opProductOutbound: true,
        opProductInbound: true,
      },
    },
    // —— 锂盐回收（酸浸 / 沉锂）单元操作，对齐现场调研 ——
    {
      category: '配料',
      name: '投料浆化',
      instruction: '含锂原料入槽浆化，核对批次与含量后加底水搅拌。',
      gateMode: 'record',
      transferCondition: '浆化均匀、批次核对完成可进入酸浸',
      responsibleType: 'position',
      responsibleName: '配料岗',
      equipmentIds: [EQ.R101],
      formTemplateId: 'pft-feed',
      operations: { opFeeding: true, opStart: true, opFinish: true },
    },
    {
      category: '反应',
      name: '一次酸浸',
      instruction: '加酸与辅料浸出锂，现场按杂质与 pH 决定补酸、补时或升温。',
      params: [
        { name: '温度', unit: '℃', target: 85, min: 75, max: 95 },
        { name: '时间', unit: 'min', target: 180, min: 120, max: 300 },
        { name: 'pH', unit: '', target: 1.5, min: 1.0, max: 2.5 },
      ],
      gateMode: 'record',
      transferCondition: '化验杂质与 pH 达标后可压滤（前段只记录，由技术员判定）',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-acid-leach',
          bizScope: '生产过程检',
          assayType: 'in_process',
          gateMode: 'record',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '分离',
      name: '压滤',
      instruction: '固液分离：浓滤液作卤水，滤渣洗涤后入库；洗渣水可回前段做底水。',
      gateMode: 'hard',
      transferCondition: '卤水与渣分别收集并过磅完成后可放行',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true, opQc: true, opInbound: true },
      qcConfigs: [
        {
          id: 'pqc-press-release',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '分离',
      name: '洗渣',
      instruction: '多级洗涤滤渣，洗水回打前道做底水，末次渣入库。',
      gateMode: 'record',
      transferCondition: '洗涤完成、渣过磅后可放行',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true },
    },
    {
      category: '分离',
      name: '氟渣洗涤',
      instruction: '一次净化氟渣洗涤；洗后渣进压滤，洗水可回前段。',
      gateMode: 'record',
      transferCondition: '洗涤完成可进压滤',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true },
    },
    {
      category: '分离',
      name: '钙镁渣洗涤',
      instruction: '二次浆化钙镁渣洗涤；洗后渣进压滤。',
      gateMode: 'record',
      transferCondition: '洗涤完成可进压滤',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true },
    },
    {
      category: '反应',
      name: '一次净化',
      instruction: '卤水除氟：加除氟剂，氟沉为固体后压滤；不合格不得往下。',
      params: [
        { name: '温度', unit: '℃', target: 60, min: 50, max: 70 },
        { name: '时间', unit: 'min', target: 60, min: 40, max: 90 },
      ],
      gateMode: 'hard',
      transferCondition: '氟指标合格后方可进入二次浆化',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201, EQ.T501],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-defluor',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '反应',
      name: '二次浆化',
      instruction: '除钙镁：调 pH 沉出钙镁，渣可送火法；不合格不得沉锂。',
      params: [
        { name: 'pH', unit: '', target: 10.5, min: 9.5, max: 11.5 },
        { name: '时间', unit: 'min', target: 90, min: 60, max: 150 },
      ],
      gateMode: 'hard',
      transferCondition: '钙镁指标合格后方可沉锂',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-ca-mg',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '反应',
      name: '沉锂',
      instruction: '加碳酸钠沉出碳酸锂；浆不合格留在本道继续处理，达标才往下。',
      params: [
        { name: '温度', unit: '℃', target: 90, min: 80, max: 95 },
        { name: '时间', unit: 'min', target: 120, min: 90, max: 180 },
        { name: '转速', unit: 'rpm', target: 40, min: 30, max: 60 },
      ],
      gateMode: 'hard',
      transferCondition: '沉锂浆化验合格后方可洗涤离心',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-precip',
          bizScope: '生产过程检',
          assayType: 'release',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
    {
      category: '分离',
      name: '锂盐洗涤',
      instruction: '洗涤碳酸锂浆，尾水去脱碳 / MVR 浓缩后作母液回流。',
      gateMode: 'hard',
      transferCondition: '洗涤完成可进入离心',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.F301],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true },
    },
    {
      category: '反应',
      name: '脱碳',
      instruction: '沉锂后液加酸脱除碳酸根，为除磷与浓缩做准备。',
      gateMode: 'record',
      transferCondition: '脱碳完成可进入除磷',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true },
    },
    {
      category: '反应',
      name: '除磷',
      instruction: '加聚合硫酸铁、片碱除磷；渣另收，母液可回流一次净化。',
      gateMode: 'record',
      transferCondition: '除磷完成可进入 MVR 浓缩',
      responsibleType: 'position',
      responsibleName: '反应岗',
      equipmentIds: [EQ.R201],
      formTemplateId: 'pft-react',
      operations: { opFeeding: true, opStart: true, opFinish: true },
    },
    {
      category: '分离',
      name: 'MVR浓缩',
      instruction: '尾水 / 母液浓缩约 10 倍后打回一次净化再走除杂沉锂。',
      gateMode: 'record',
      transferCondition: '浓缩完成可作母液回流或出钠盐',
      responsibleType: 'position',
      responsibleName: '分离岗',
      equipmentIds: [EQ.T601],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true },
    },
    {
      category: '灌装',
      name: '包装',
      instruction: '成品按 800kg/袋包装，袋上写名称、日期、净重；工碳纯度 ≥98.5%。',
      gateMode: 'hard',
      transferCondition: '成品化验合格且过磅完成后方可入库',
      responsibleType: 'position',
      responsibleName: '灌装岗',
      equipmentIds: [EQ.P701],
      formTemplateId: 'pft-separate',
      operations: { opStart: true, opFinish: true, opInbound: true, opQc: true },
      qcConfigs: [
        {
          id: 'pqc-lic-fg',
          bizScope: '成品检',
          assayType: 'finished',
          gateMode: 'hard',
          allowMultiple: true,
        },
      ],
    },
  ]

  return defs.map((item, index) => {
    const operations = defaultOperations(item.operations || {})
    const qcConfigs = Array.isArray(item.qcConfigs) ? item.qcConfigs : []
    if (qcConfigs.length) operations.opQc = true
    const responsibleName = item.responsibleName
    return {
      id: `proc-op-${String(index + 1).padStart(3, '0')}`,
      code: padCode(index + 1),
      name: item.name,
      category: item.category,
      instruction: item.instruction,
      params: item.params || [],
      gateMode: item.gateMode,
      transferCondition: item.transferCondition,
      equipmentIds: [...(item.equipmentIds || [])],
      formTemplateId: item.formTemplateId || '',
      responsibleType: 'position',
      responsibleName,
      resourceType: '岗位',
      position: responsibleName || '',
      image: '',
      remark: '',
      status: '使用中',
      isBlanking: false,
      operations,
      qcConfigs,
      defaultExecutors: [item.responsibleName],
      reportMode: '',
      taskExecutionMode: 'single_claim',
      defectItemIds: [],
      reportQtyMode: 'schedule',
      wageQtyMode: 'reported',
      workItemTemplates: [],
      createdAt: '2026-11-16',
      updatedAt: '2026-11-16',
    }
  })
}
