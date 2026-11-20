export {
  barcodeTypeOptions,
  materialTypeOptions,
  supplyFormOptions,
  inventoryUnitOptions,
  reportTypeOptions,
  salaryMethodOptions,
  workCenterOpts,
  processRouteOpts,
  warehouseOpts,
  supplierOpts,
  processOpts,
  createDefaultLaborRow,
  createDefaultProductionControl,
  createDefaultAlertConfig,
} from '@/mock/materialInfoOptions'

export const productAttributeOptions = ['标准产品', '定制产品']

/** 储存条件（可多选） */
export const STORAGE_CONDITION_OPTIONS = [
  '常温密封',
  '阴凉避光',
  '冷藏',
  '干燥防潮',
  '防火防静电',
  '罐内保温',
  '隔离存放',
  '危废暂存',
]

const STORAGE_CONDITION_RULES = [
  { test: /冷藏|冷冻/, value: '冷藏' },
  { test: /避光|日晒/, value: '阴凉避光' },
  { test: /干燥|受潮|结块/, value: '干燥防潮' },
  { test: /防火|防静电/, value: '防火防静电' },
  { test: /保温/, value: '罐内保温' },
  { test: /危废|防泄漏/, value: '危废暂存' },
  { test: /分开|隔离/, value: '隔离存放' },
  { test: /密封|常温|阴凉/, value: '常温密封' },
]

/** 自由文本或已选值收成储存条件枚举 */
export function normalizeStorageConditions(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[、,，]/)
  const picked = []
  source.forEach((item) => {
    const text = String(item || '').trim()
    if (!text) return
    if (STORAGE_CONDITION_OPTIONS.includes(text)) {
      picked.push(text)
      return
    }
    STORAGE_CONDITION_RULES.forEach((rule) => {
      if (rule.test.test(text)) picked.push(rule.value)
    })
  })
  return [...new Set(picked)]
}

export function formatStorageConditions(value) {
  const list = normalizeStorageConditions(value)
  return list.length ? list.join('、') : ''
}

/** 可销售产品的属性 */
export const wholeMachineProductAttributeOptions = ['标准产品', '定制产品']

export const STANDARD_PART_ATTRIBUTE = '标准零部件'
export const CUSTOM_PART_ATTRIBUTE = '定制零部件'

/** 标准/定制零部件 */
export const PART_PRODUCT_ATTRIBUTES = [STANDARD_PART_ATTRIBUTE, CUSTOM_PART_ATTRIBUTE]

export const partProductAttributeOptions = [...PART_PRODUCT_ATTRIBUTES]

const LEGACY_PART_ATTRIBUTE_MAP = {
  '标准-成品零部件': STANDARD_PART_ATTRIBUTE,
  '定制-成品零部件': CUSTOM_PART_ATTRIBUTE,
  '标准-成品': STANDARD_PART_ATTRIBUTE,
  试制产品: CUSTOM_PART_ATTRIBUTE,
}

export function normalizePartProductAttribute(value) {
  const text = String(value || '').trim()
  if (LEGACY_PART_ATTRIBUTE_MAP[text]) return LEGACY_PART_ATTRIBUTE_MAP[text]
  if (PART_PRODUCT_ATTRIBUTES.includes(text)) return text
  return STANDARD_PART_ATTRIBUTE
}

export function isPartProductAttribute(productAttribute) {
  return PART_PRODUCT_ATTRIBUTES.includes(normalizePartProductAttribute(productAttribute))
}

export const standardSpecOptions = ['国标', '行标', '企标', 'ISO标准']

/** 计划策略：按批生产 / 备库存。旧值 mto→batch，mts 与 mto_mts→stock。 */
export const PLAN_STRATEGY = {
  BATCH: 'batch',
  STOCK: 'stock',
  MTO: 'mto',
  MTS: 'mts',
  MTO_MTS: 'mto_mts',
}

export function normalizePlanStrategy(value) {
  if (!value) return undefined
  if (
    value === PLAN_STRATEGY.MTS ||
    value === PLAN_STRATEGY.MTO_MTS ||
    value === PLAN_STRATEGY.STOCK
  ) {
    return PLAN_STRATEGY.STOCK
  }
  if (value === PLAN_STRATEGY.MTO || value === PLAN_STRATEGY.BATCH) return PLAN_STRATEGY.BATCH
  return undefined
}

export const PLAN_STRATEGY_OPTIONS = [
  { value: PLAN_STRATEGY.BATCH, label: '按批生产' },
  { value: PLAN_STRATEGY.STOCK, label: '备库存' },
]

export function planStrategyLabel(value) {
  const normalized = normalizePlanStrategy(value)
  const hit = PLAN_STRATEGY_OPTIONS.find((o) => o.value === normalized)
  return hit?.label || PLAN_STRATEGY_OPTIONS[0].label
}

/** 是否备库存（含历史 MTS） */
export function isPlanStrategyMts(value) {
  return normalizePlanStrategy(value) === PLAN_STRATEGY.STOCK
}

/** 是否按批生产（含历史 MTO） */
export function isPlanStrategyMto(value) {
  return normalizePlanStrategy(value) === PLAN_STRATEGY.BATCH || !value
}

export function createDefaultProductProduction() {
  return {
    planStrategy: undefined,
    replenishQty: undefined,
    defaultWorkCenter: undefined,
    standardCycleDays: undefined,
    defaultProcessRoute: undefined,
    defaultSupplier: undefined,
    defaultOutsourceSupplier: undefined,
    defaultWarehouse: undefined,
    needIndustrialLabel: false,
  }
}

export function createDefaultProductAlert() {
  return {
    stockAlertEnabled: false,
    maxStockQty: undefined,
    minStockQty: undefined,
    expiryAlertEnabled: false,
    expiryAlertDays: undefined,
    defectRateThreshold: undefined,
    attachments: [],
  }
}
