import { reactive, watch } from 'vue'
import { persistJson } from '@/utils/safeStorage'
import {
  STOCK_FULFILLMENT_MODE,
  STOCK_FULFILLMENT_MODE_OPTIONS,
  normalizeStockFulfillmentMode,
} from '@/utils/salesStockFulfillment'
import {
  ROUTE_MODE_OPTIONS,
  ROUTE_MODE_PROCESS,
  normalizeRouteMode,
} from '@/constants/processRouteMode'

const STORAGE_KEY = 'i_doms_function_params'
/** 尺寸辅助默认从「全关」升级为「全开」的一次性迁移版本 */
const BLANK_SIZE_ASSIST_DEFAULTS_VERSION = 2

export const SALARY_PUSH_MODES = {
  ON_REPORT: 'on_report',
  ON_AUDIT: 'on_audit',
  MANUAL: 'manual',
}

export const SALARY_PUSH_OPTIONS = [
  { value: SALARY_PUSH_MODES.ON_REPORT, label: '报工即推送' },
  { value: SALARY_PUSH_MODES.ON_AUDIT, label: '审核后推送' },
  { value: SALARY_PUSH_MODES.MANUAL, label: '手动推送' },
]

export const SALARY_PUSH_DESCRIPTION =
  '报工即推送：报工即展示在工时工资列表中，工人可查看。审核后推送：审核通过后展示在工时工资列表中，工人可查看。手动推送：手动操作推送后，工人在工时工资列表中可查看。'

export const AUTO_GENERATE_DOC_TYPES = {
  PURCHASE_REQUISITION: 'purchaseRequisition',
  OUTSOURCING_ORDER: 'outsourcingOrder',
  PRODUCTION_WORK_ORDER: 'productionWorkOrder',
  ASSEMBLY_WORK_ORDER: 'assemblyWorkOrder',
}

export const AUTO_GENERATE_DOC_OPTIONS = [
  { value: AUTO_GENERATE_DOC_TYPES.PURCHASE_REQUISITION, label: '采购申请单' },
  { value: AUTO_GENERATE_DOC_TYPES.OUTSOURCING_ORDER, label: '外协订单' },
  { value: AUTO_GENERATE_DOC_TYPES.PRODUCTION_WORK_ORDER, label: '生产工单' },
]

export const AUTO_GENERATE_DOC_DESCRIPTION =
  '勾选相应单据，销售订单审核后，系统将根据物料的供应型态自动生成相应单据。'

export const INVENTORY_DEDUCT_MODES = {
  NO_ISSUE: 'no_issue',
  POST_COMPLETE_BY_REPORT: 'post_complete_by_report',
  SELF_ISSUE_BY_ACTUAL: 'self_issue_by_actual',
}

export const INVENTORY_DEDUCT_OPTIONS = [
  {
    value: INVENTORY_DEDUCT_MODES.NO_ISSUE,
    label: '不领料（极简报工 / 无工单）',
  },
  {
    value: INVENTORY_DEDUCT_MODES.POST_COMPLETE_BY_REPORT,
    label: '完工后预扣+确认（无领料，按 BOM×完工数扣发料仓）',
  },
  {
    value: INVENTORY_DEDUCT_MODES.SELF_ISSUE_BY_ACTUAL,
    label: '自主领料+完工后预扣+确认（按 BOM×完工数扣线边仓）',
  },
]

/**
 * 三档口径（极简生产）：
 * 1) 不领料：无工单、仅快速报工；不走工单完工库存扣减
 * 2) 完工后预扣+确认：有工单但不领料；工单完工按 BOM 单位用量×完工数量，默认扣发料仓；仓库可改；不可自动确认
 * 3) 自主领料+完工后预扣+确认：有工单且自主领料（领料数量≠消耗）；出库只是发料仓→线边仓调拨；
 *    完工再按 BOM×完工数扣线边仓（仓库可改）；可自动确认；库存不足则该行/单据扣减失败
 */
export const INVENTORY_DEDUCT_DESCRIPTION =
  '①不领料：适用于极简报工、无工单、仅快速报工的场景，不生成工单完工库存扣减。' +
  '②完工后预扣+确认：有工单但不领料，完工时按 BOM 单位用量×工单完工数量预扣，默认扣发料仓（仓库可改），须人工确认，不可自动确认。' +
  '③自主领料+完工后预扣+确认：有工单且走领料单（领料数量可改，领多少≠用多少）；出库将料从发料仓转入线边仓；' +
  '完工再按 BOM×完工数量扣线边仓（仓库可改），可勾选自动审批自动确认；库存不足则扣减失败。' +
  '下料结算已固定为无需结算：余料留在现场，库存扣减仍按本项口径实扣。'

/** 车间暂存合并入库时，多批有效含量如何处理（一期仅开放「相同才可合」） */
export const WORKSHOP_STAGING_MERGE_CONTENT_MODES = {
  SAME: 'same',
  WEIGHTED_AVG: 'weighted_avg',
  SPLIT_LINES: 'split_lines',
}

export const WORKSHOP_STAGING_MERGE_CONTENT_OPTIONS = [
  { value: WORKSHOP_STAGING_MERGE_CONTENT_MODES.SAME, label: '含量须相同才可合' },
  {
    value: WORKSHOP_STAGING_MERGE_CONTENT_MODES.WEIGHTED_AVG,
    label: '加权平均（二期）',
    disabled: true,
  },
  {
    value: WORKSHOP_STAGING_MERGE_CONTENT_MODES.SPLIT_LINES,
    label: '同单拆行保留各批含量（二期）',
    disabled: true,
  },
]

export const WORKSHOP_STAGING_MERGE_CONTENT_DESCRIPTION =
  '控制「待处置产出」合并入库时，多条车间暂存批的有效含量规则。本期仅开放「含量须相同」；加权平均与拆行后续开放。'

/**
 * 出库规则（领料 / 外协发料等仓库出库；销售发货见 salesOutboundIssueRule）
 * - fefo：近效先出（失效日期升序，同效期再按批次号先进先出）；过期批不参与
 * - manual：必须自主选批
 * - either：默认 FEFO，行上可改自主选批
 */
export const OUTBOUND_ISSUE_RULES = {
  FEFO: 'fefo',
  /** @deprecated 兼容旧存档，归一为 FEFO */
  FIFO: 'fifo',
  /** @deprecated 兼容旧存档，归一为 FEFO */
  LIFO: 'lifo',
  MANUAL: 'manual',
  EITHER: 'either',
}

export const OUTBOUND_ISSUE_RULE_OPTIONS = [
  { value: OUTBOUND_ISSUE_RULES.FEFO, label: 'FEFO（近效先出）' },
  { value: OUTBOUND_ISSUE_RULES.MANUAL, label: '自主选批' },
  { value: OUTBOUND_ISSUE_RULES.EITHER, label: '两者皆可' },
]

export const OUTBOUND_ISSUE_RULE_DESCRIPTION =
  '控制仓库出库如何扣批：' +
  '①FEFO：先按失效日期近的先出，同效期再按批次号先进先出；过期批不可扣；需下料结算物料仍叠加「余料优先 / 最短够用」。' +
  '②自主选批：出库必须选手选批次，不自动扣批。' +
  '③两者皆可：默认按 FEFO 预分配，行上可点「自主拣选」改实发批。' +
  '领料、外协发料走本项；销售发货见下方「发货出库规则」。有效含量跟过账实扣批次走。'

/**
 * 销售发货出库如何扣批（不影响领料 / 外协发料）
 * - by_order：按单发货，先扣本销售单打标批次，禁止 FIFO 抢走他单按单库存
 * - fifo：发货按仓库批次先进先出，不区分是否本单库存
 */
export const SALES_OUTBOUND_ISSUE_RULES = {
  BY_ORDER: 'by_order',
  FIFO: 'fifo',
}

export const SALES_OUTBOUND_ISSUE_RULE_OPTIONS = [
  { value: SALES_OUTBOUND_ISSUE_RULES.BY_ORDER, label: '按单发货' },
  { value: SALES_OUTBOUND_ISSUE_RULES.FIFO, label: '先进先出（FIFO）' },
]

export const SALES_OUTBOUND_ISSUE_RULE_DESCRIPTION =
  '只作用于销售发货出库，领料、外协发料仍走上方「出库规则」。' +
  '按单发货：成品/半成品入库时挂了本销售单的批次，发货时优先扣这些批次，不能用全仓先进先出把别人订单的货发出去。' +
  '本单按单批不足时，可用自由备货补足（含归属已转自由后的库存）；仍禁止扣他单按单批。' +
  '「强制按单生产/采购」只约束审核时全量排产或采购、不新占自由备货，发货扣批与「优先现货」相同（先本单再自由）。' +
  '先进先出（FIFO）：发货时不管批次是不是本单生产的，按仓库里批次先后扣减，适合不需要按订单锁货的场景。'

/**
 * 随货配件在哪一环节确定纳入清单
 * - order：销售订单时确定清单与采购；发货继承，本票仅勾选发哪些/改数量，不可新增配件
 * - apply：申请发货时确定，发货单可添加配件（能力对齐销售订单随货配件）
 * - off：关闭，销售订单与发货均不展示随货配件
 * - warehouse：仓管发货时确定（暂隐藏，未开放）
 */
export const SHIP_ATTACHMENT_DECIDE_STAGES = {
  ORDER: 'order',
  APPLY: 'apply',
  OFF: 'off',
  WAREHOUSE: 'warehouse',
}

/** 页面可选（仓管发货时确定暂不开放） */
export const SHIP_ATTACHMENT_DECIDE_STAGE_OPTIONS = [
  { value: SHIP_ATTACHMENT_DECIDE_STAGES.ORDER, label: '销售订单时确定' },
  { value: SHIP_ATTACHMENT_DECIDE_STAGES.APPLY, label: '申请发货时确定' },
  { value: SHIP_ATTACHMENT_DECIDE_STAGES.OFF, label: '关闭' },
]

export const SHIP_ATTACHMENT_DECIDE_STAGE_DESCRIPTION =
  '销售订单时确定：下单维护随货配件并可转采购；发货继承订单清单，本票仅勾选发哪些、调整发货数量，不可新增配件。' +
  '申请发货时确定：新增/编辑发货单时可添加配件（配件包、从主数据添加），能力与销售订单随货配件一致。' +
  '关闭：销售订单与发货均不展示随货配件相关信息。' +
  '「仓管发货时确定」暂未开放。'

/**
 * 调拨：出库确认后是否还需入库方签收
 * - true：生成调拨入库待签收，需入库方确认完结
 * - false：出库确认后自动入库完结
 */
export const TRANSFER_REQUIRE_INBOUND_CONFIRM_DESCRIPTION =
  '需要：调拨出库确认后生成调拨入库单，须入库方签收后完结。' +
  '自动：调拨出库确认后系统自动完成入库，无需入库方再签收。'

/**
 * 盘点：审核通过后是否自动生成盘盈盘亏并过账
 * - true：审核通过后立即过账
 * - false：审核通过后停留待过账，需手动点「生成盘盈盘亏」
 */
export const STOCKTAKE_AUTO_POST_ON_APPROVE_DESCRIPTION =
  '自动：盘点单审核通过后立即生成盘盈入库 / 盘亏出库并入账；失败则仍保持审核通过并标记过账失败，可手工重试。' +
  '手动：审核通过后需在列表或详情点击「生成盘盈盘亏」才会过账。'

/**
 * 下料结算相关发料策略（仅作用于勾选「需要下料结算」能力的物料场景；普通料不受本项影响）
 * 业务口径：确认出库一律按出库单数量扣库存；本项只区分发料后余料是否还要走下料结算回库。
 * - partial：无需下料结算（余料留线边仓等，不再回库结算）
 * - whole_with_remnant：需下料结算（登记实耗，余料回库）
 */
export const DUAL_UNIT_ISSUE_STRATEGIES = {
  PARTIAL: 'partial',
  WHOLE_WITH_REMNANT: 'whole_with_remnant',
}

export const DUAL_UNIT_ISSUE_STRATEGY_OPTIONS = [
  {
    value: DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL,
    label: '无需下料结算（余料留线边仓）',
    disabled: false,
  },
  {
    value: DUAL_UNIT_ISSUE_STRATEGIES.WHOLE_WITH_REMNANT,
    label: '需下料结算（余料回库）',
    disabled: false,
  },
]

export const DUAL_UNIT_ISSUE_STRATEGY_DESCRIPTION =
  '确认出库时，系统一律按出库单上的数量扣减库存（给多少就写多少、扣多少）。' +
  '本项不改变扣库数量，只区分发料后对余料的处理：' +
  '「无需下料结算」——余料留在线边仓/现场，不再做下料结算回库；' +
  '「需下料结算」——领出后登记实耗，余料通过下料结算回库。' +
  '仅对需要管余料的下料类物料有意义；普通物料不受本项影响。'

/** 下料/订货尺寸辅助（勾选即显示对应能力，默认开启） */
export const BLANK_SIZE_ASSIST_TYPES = {
  PLATE_AREA_MEASURE: 'plateAreaMeasure',
  BOM_WEIGHT_CALC: 'bomWeightCalc', // 存储键兼容；作用于 BOM 下料尺寸与采购订货尺寸
}

export const BLANK_SIZE_ASSIST_OPTIONS = [
  { value: BLANK_SIZE_ASSIST_TYPES.PLATE_AREA_MEASURE, label: '面积换算' },
  { value: BLANK_SIZE_ASSIST_TYPES.BOM_WEIGHT_CALC, label: '重量计算' },
]

export const BLANK_SIZE_ASSIST_DESCRIPTION =
  '作用于 BOM「下料尺寸」与采购「订货尺寸」弹窗，默认开启；勾选即显示，取消勾选则不显示。' +
  '「面积换算」：弹窗可选「面积计算」，库存单位为㎡时入库也可用「长 × 宽」换算面积。' +
  '「重量计算」：弹窗增加「重量计算」页签，可按型材/密度估算重量并回填尺寸（BOM 下料另回填单位用量）。' +
  '不需要面积或重量辅助的客户取消勾选即可。'

export const ENABLE_BOM_LEVEL_MTS_DESCRIPTION =
  '开启后，生产计划展开 BOM 时支持子件级按库存MTS：子件主数据为按库存MTS 且库存充足时，可不下推该层生产/采购需求；关闭则生产计划仍按订单展开，仅成品级计划策略生效。默认关闭。'

export const PAYMENT_LINK_MODES = {
  CONTRACT: 'contract',
  ORDER: 'order',
  BOTH: 'both',
}

export const PAYMENT_LINK_MODE_OPTIONS = [
  { value: PAYMENT_LINK_MODES.CONTRACT, label: '按合同' },
  { value: PAYMENT_LINK_MODES.ORDER, label: '按订单' },
  { value: PAYMENT_LINK_MODES.BOTH, label: '合同与订单均可' },
]

export const PAYMENT_LINK_MODE_DESCRIPTION =
  '决定回款管理按谁挂账。按合同：列表以合同回款为主，未挂合同的已审订单仍可作例外登记。' +
  '按订单：列表与登记默认走销售订单，适合不做合同的企业。' +
  '合同与订单均可：保留全部 / 合同回款 / 订单回款三个列表。'

function normalizePaymentLinkMode(mode) {
  if (PAYMENT_LINK_MODE_OPTIONS.some((item) => item.value === mode)) return mode
  return PAYMENT_LINK_MODES.BOTH
}

function normalizeSalesOrderStockFulfillmentDefault(mode) {
  return normalizeStockFulfillmentMode(mode || STOCK_FULFILLMENT_MODE.PREFER_STOCK)
}

export const ENABLE_SALES_ORDER_DISCOUNT_DESCRIPTION =
  '开启：销售订单可使用折扣策略（无折扣 / 仅明细折扣 / 仅整单折扣）、行折扣与整单优惠。' +
  '关闭：新建/编辑订单不展示上述折扣能力，按成交单价计价；合同仍只写入协议单价，不把协议折扣写进行折扣。' +
  '默认开启。'

/** 新建销售订单明细行「库存履约」默认值（与行级可选值一致） */
export { STOCK_FULFILLMENT_MODE_OPTIONS as SALES_ORDER_STOCK_FULFILLMENT_DEFAULT_OPTIONS }

export const SALES_ORDER_STOCK_FULFILLMENT_DEFAULT_DESCRIPTION =
  '新建销售订单时，明细行「库存履约」的初始值。' +
  '可在下单时逐行修改；不影响已保存订单。默认「优先现货」。'

/** 质检门控：按业务类型配置（强管控阻断 / 弱管控仅预警） */
export const QC_GATE_POLICY_PARAM_OPTIONS = [
  { value: 'soft', label: '弱管控（仅预警）' },
  { value: 'hard', label: '强管控（阻断下游）', disabled: true },
]

export const QC_GATE_POLICY_BIZ_SCOPES = [
  '来料质检',
  '外协回货检',
  '生产过程检',
  '成品检',
  '出厂质检',
]

export const QC_GATE_POLICY_DESCRIPTION =
  '按质检业务类型配置下游门控强度。弱管控：未检/不合格等场景 Toast 预警，不拦截入库、报工、出库操作；强管控：直接阻断。当期仅开放弱管控，强管控后续开放。'

function normalizeQcGatePolicyParam(value) {
  const v = String(value || '').trim()
  if (v === 'strong') return 'hard'
  if (v === 'weak') return 'soft'
  const hit = QC_GATE_POLICY_PARAM_OPTIONS.find((o) => o.value === v)
  // 当期仅开放弱管控；历史 hard / 非法值一律回落 soft
  if (hit && !hit.disabled) return hit.value
  return 'soft'
}

function normalizeQcGatePolicyMap(map = {}) {
  const result = {}
  QC_GATE_POLICY_BIZ_SCOPES.forEach((scope) => {
    result[scope] = normalizeQcGatePolicyParam(map?.[scope])
  })
  return result
}

export const AUTO_APPROVE_TYPES = {
  PURCHASE_ORDER: 'purchaseOrder',
  SALES_ORDER: 'salesOrder',
  SALES_ORDER_PRICE_CHANGE: 'salesOrderPriceChange',
  PURCHASE_ORDER_PRICE_CHANGE: 'purchaseOrderPriceChange',
  OUTSOURCING_ORDER_PRICE_CHANGE: 'outsourcingOrderPriceChange',
  OUTSOURCING_ORDER: 'outsourcingOrder',
  SALES_CONTRACT: 'salesContract',
  SALES_CONTRACT_CHANGE: 'salesContractChange',
  FINISHED_INBOUND: 'finishedInbound',
  MATERIAL_REQUISITION: 'materialRequisition',
  INVENTORY_DEDUCT: 'inventoryDeduct',
  SCRAP_ORDER: 'scrapOrder',
}

export const AUTO_APPROVE_OPTIONS = [
  { value: AUTO_APPROVE_TYPES.PURCHASE_ORDER, label: '采购订单' },
  { value: AUTO_APPROVE_TYPES.SALES_ORDER, label: '销售订单' },
  { value: AUTO_APPROVE_TYPES.SALES_ORDER_PRICE_CHANGE, label: '销售订单变更' },
  { value: AUTO_APPROVE_TYPES.PURCHASE_ORDER_PRICE_CHANGE, label: '采购订单价格变更' },
  { value: AUTO_APPROVE_TYPES.OUTSOURCING_ORDER_PRICE_CHANGE, label: '外协订单价格变更' },
  { value: AUTO_APPROVE_TYPES.OUTSOURCING_ORDER, label: '外协订单' },
  { value: AUTO_APPROVE_TYPES.SALES_CONTRACT, label: '合同审批' },
  { value: AUTO_APPROVE_TYPES.SALES_CONTRACT_CHANGE, label: '合同变更审批' },
  { value: AUTO_APPROVE_TYPES.FINISHED_INBOUND, label: '成品入库申请' },
  { value: AUTO_APPROVE_TYPES.MATERIAL_REQUISITION, label: '领料申请' },
  { value: AUTO_APPROVE_TYPES.INVENTORY_DEDUCT, label: '库存扣减' },
  { value: AUTO_APPROVE_TYPES.SCRAP_ORDER, label: '报废单审批' },
]

export const AUTO_APPROVE_DESCRIPTION =
  '勾选后对应单据提交即自动审批通过。勾选「销售订单变更」后，订单变更单提交即回写基本信息与销售明细（数量、交期、税率、单价、折扣、取消行及客户等）；勾选「采购订单价格变更」后，价格变更单提交即回写采购订单有效价；勾选「外协订单价格变更」后，价格变更单提交即回写外协订单有效价。' +
  '勾选「合同审批」后，销售合同提交即自动生效；勾选「合同变更审批」后，合同变更单提交即自动应用到合同。自动审批时审核人显示为「系统自动审批」。' +
  '未勾选「领料申请」时，领料申请单需人工审核（待审核 → 审核通过 / 审核驳回）。' +
  '未勾选「成品入库申请」时，成品入库申请单需人工审核（待审核 → 审核通过 / 审核驳回）；勾选后提交即审核通过并生成成品入库单。' +
  '「库存扣减」自动确认仅对「自主领料+完工后预扣+确认」生效：勾选后生成扣减单即自动确认；未勾选则须人工确认。' +
  '「完工后预扣+确认（无领料）」无论是否勾选，均须人工确认，不可自动确认。' +
  '勾选「报废单审批」表示报废单走自动审批（配置项已展示，报废业务侧暂未接入读取）。'

function createDefaultAutoGenerateDocs() {
  return {
    [AUTO_GENERATE_DOC_TYPES.PURCHASE_REQUISITION]: false,
    [AUTO_GENERATE_DOC_TYPES.OUTSOURCING_ORDER]: false,
    [AUTO_GENERATE_DOC_TYPES.PRODUCTION_WORK_ORDER]: false,
    [AUTO_GENERATE_DOC_TYPES.ASSEMBLY_WORK_ORDER]: false,
  }
}

function normalizeAutoGenerateDocs(value) {
  const defaults = createDefaultAutoGenerateDocs()
  if (!value || typeof value !== 'object') return defaults
  return {
    ...defaults,
    ...Object.fromEntries(
      AUTO_GENERATE_DOC_OPTIONS.map((item) => [item.value, Boolean(value[item.value])]),
    ),
    [AUTO_GENERATE_DOC_TYPES.ASSEMBLY_WORK_ORDER]: false,
  }
}

function createDefaultAutoApproveDocs() {
  return {
    [AUTO_APPROVE_TYPES.PURCHASE_ORDER]: false,
    [AUTO_APPROVE_TYPES.SALES_ORDER]: false,
    [AUTO_APPROVE_TYPES.SALES_ORDER_PRICE_CHANGE]: false,
    [AUTO_APPROVE_TYPES.PURCHASE_ORDER_PRICE_CHANGE]: false,
    [AUTO_APPROVE_TYPES.OUTSOURCING_ORDER_PRICE_CHANGE]: false,
    [AUTO_APPROVE_TYPES.OUTSOURCING_ORDER]: false,
    [AUTO_APPROVE_TYPES.SALES_CONTRACT]: false,
    [AUTO_APPROVE_TYPES.SALES_CONTRACT_CHANGE]: false,
    [AUTO_APPROVE_TYPES.FINISHED_INBOUND]: false,
    [AUTO_APPROVE_TYPES.MATERIAL_REQUISITION]: false,
    [AUTO_APPROVE_TYPES.INVENTORY_DEDUCT]: false,
    [AUTO_APPROVE_TYPES.SCRAP_ORDER]: false,
  }
}

function normalizeAutoApproveDocs(value) {
  const defaults = createDefaultAutoApproveDocs()
  if (!value || typeof value !== 'object') return defaults
  return {
    ...defaults,
    ...Object.fromEntries(
      AUTO_APPROVE_OPTIONS.map((item) => [item.value, Boolean(value[item.value])]),
    ),
  }
}

function createDefaultBlankSizeAssistTools() {
  return {
    [BLANK_SIZE_ASSIST_TYPES.PLATE_AREA_MEASURE]: false,
    [BLANK_SIZE_ASSIST_TYPES.BOM_WEIGHT_CALC]: false,
  }
}

/** 兼容旧版独立开关 enablePlateAreaMeasure / enableBomWeightCalc */
function normalizeBlankSizeAssistTools(value, legacy = {}) {
  const defaults = createDefaultBlankSizeAssistTools()
  if (value && typeof value === 'object') {
    return {
      ...defaults,
      ...Object.fromEntries(
        BLANK_SIZE_ASSIST_OPTIONS.map((item) => [item.value, Boolean(value[item.value])]),
      ),
    }
  }
  const hasLegacyPlate = Object.prototype.hasOwnProperty.call(legacy, 'enablePlateAreaMeasure')
  const hasLegacyWeight = Object.prototype.hasOwnProperty.call(legacy, 'enableBomWeightCalc')
  return {
    ...defaults,
    [BLANK_SIZE_ASSIST_TYPES.PLATE_AREA_MEASURE]: hasLegacyPlate
      ? legacy.enablePlateAreaMeasure === true
      : defaults[BLANK_SIZE_ASSIST_TYPES.PLATE_AREA_MEASURE],
    [BLANK_SIZE_ASSIST_TYPES.BOM_WEIGHT_CALC]: hasLegacyWeight
      ? legacy.enableBomWeightCalc === true
      : defaults[BLANK_SIZE_ASSIST_TYPES.BOM_WEIGHT_CALC],
  }
}

/** 功能参数分类（左侧锚点 / 右侧分组） */
export const FUNCTION_PARAM_CATEGORIES = [
  {
    key: 'automation',
    label: '流程自动化',
    description: '控制单据自动生成与自动审批，减少人工确认。',
  },
  {
    key: 'bom',
    label: 'BOM与工艺文件',
    description: 'BOM 生效策略、自构成与工艺文件管理方式。',
  },
  {
    key: 'inventory',
    label: '库存与出库',
    description: '库存扣减时机、出库拣选与发货相关规则。',
  },
  {
    key: 'sales',
    label: '销售',
    description: '销售订单计价、折扣、库存履约默认值与回款挂接相关配置。',
  },
  {
    key: 'production',
    label: '生产与计划',
    description: '工艺路线模式、投料扣减与工资推送相关配置。',
  },
  {
    key: 'quality',
    label: '质量',
    description: '质检下游门控强度（入库 / 报工 / 出库）。',
  },
  {
    key: 'message',
    label: '消息通知',
    description: '消息推送相关开关。',
  },
]

export const WORK_ORDER_MATERIAL_SETTING_OPTIONS = [
  { value: 'enableMaterialReqCalc', label: '启用工单物料需求计算' },
  { value: 'enableLastProcessConsume', label: '启用最后工序报工物料消耗计算' },
  { value: 'enableSubWoViaBom', label: '启用通过BOM创建子工单' },
]

function createDefaultWorkOrderMaterialSettings() {
  return {
    enableMaterialReqCalc: true,
    enableLastProcessConsume: false,
    enableSubWoViaBom: true,
  }
}

function normalizeWorkOrderMaterialSettings(value = {}) {
  const defaults = createDefaultWorkOrderMaterialSettings()
  if (!value || typeof value !== 'object') return defaults
  return {
    enableMaterialReqCalc: Boolean(value.enableMaterialReqCalc),
    enableLastProcessConsume: Boolean(value.enableLastProcessConsume),
    enableSubWoViaBom: Boolean(value.enableSubWoViaBom),
  }
}

/** 仅页面展示的配置默认值（不驱动业务逻辑） */
function createDefaultDisplayParams() {
  return {
    wechatMessagePush: true,
    enableBomSelectSelf: true,
    enableBomApprove: true,
    reportAllowOverReport: true,
    workOrderMaterialSettings: createDefaultWorkOrderMaterialSettings(),
    processFileSelectByCategory: false,
    processFileSelectMode: 'item',
  }
}

function normalizeDisplayParams(value = {}) {
  const defaults = createDefaultDisplayParams()
  const merged = {
    ...defaults,
    ...(value && typeof value === 'object' ? value : {}),
  }
  merged.workOrderMaterialSettings = normalizeWorkOrderMaterialSettings(
    value?.workOrderMaterialSettings ?? defaults.workOrderMaterialSettings,
  )
  // 兼容旧布尔开关 processFileSelectByCategory
  const rawMode =
    value &&
    typeof value === 'object' &&
    Object.prototype.hasOwnProperty.call(value, 'processFileSelectMode')
      ? value.processFileSelectMode
      : value &&
          typeof value === 'object' &&
          Object.prototype.hasOwnProperty.call(value, 'processFileSelectByCategory')
        ? value.processFileSelectByCategory
        : defaults.processFileSelectMode
  merged.processFileSelectMode = normalizeProcessFileSelectMode(rawMode)
  merged.processFileSelectByCategory = merged.processFileSelectMode === 'category'
  return merged
}

export const WECHAT_MESSAGE_PUSH_DESCRIPTION =
  '开启后支持微信消息推送。（展示项，本期仅页面配置展示，未接入业务逻辑）'

export const ENABLE_BOM_SELECT_SELF_DESCRIPTION =
  '开启后，物料可在 BOM 中选择自身作为子级（自构成：自己构成自己）。关闭则不允许选择自身为子件。（展示项，本期仅页面配置展示，未接入业务逻辑）'

export const ENABLE_BOM_APPROVE_DESCRIPTION =
  '开启后：同一产品/物料同一时间仅允许一个「生效」BOM，新版本生效时上版本自动归档。' +
  '关闭后：同一产品/物料可同时生效多个 BOM，并可指定其中一个为默认 BOM。' +
  '（本项不是 BOM 单据自动审批。展示项，本期仅页面配置展示，未接入业务逻辑）'

export const PROCESS_FILE_SELECT_OPTIONS = [
  { value: 'item', label: '一物一图' },
  { value: 'category', label: '按类别' },
]

export const PROCESS_FILE_SELECT_DESCRIPTION =
  '「一物一图」：按产品/物料管理工艺文件，同一产品/物料在同一文件类型下同一时间仅可生效一张图。' +
  '「按类别」：按产品/物料类别上传与管理工艺文件。' +
  '（展示项，本期仅页面配置展示，未接入业务逻辑）'

function normalizeProcessFileSelectMode(value) {
  if (value === true || value === 'category') return 'category'
  if (value === false || value === 'item') return 'item'
  return 'item'
}

export const REPORT_SETTING_OPTIONS = [{ value: 'allowOverReport', label: '允许超报' }]

export const WORK_ORDER_MATERIAL_SETTINGS_DESCRIPTION =
  '工单生成与物料计算相关开关。（展示项，本期仅页面配置展示，未接入业务逻辑）'

export const REPORT_SETTINGS_DESCRIPTION =
  '报工相关约束。勾选「允许超报」后允许报工数量超过计划数量。（展示项，本期仅页面配置展示，未接入业务逻辑）'

export const ENABLE_SEQUENTIAL_PROCESS_TASK_DESCRIPTION =
  '开启后，工单下发的工序任务按工艺顺序放开：上道工序任务未报工完成前，下道工序工人不可见、不可领取。' +
  '关闭后各工序任务同时可见可接（默认）。对之后新下发的任务生效；极简报工模式仍并行下发。'

export const ENABLE_SEQUENTIAL_BATCH_STEP_DESCRIPTION =
  '开启后，批次指令工艺阶段按顺序确认：上一步未确认前，下一步不可确认。' +
  '关闭后各步可分别确认（默认）。硬门禁仍按各步自己的过程检控制；关单时仍要求全部步骤已确认。'

/** 物理支线怎么做：同批关阶段 vs 产出另开子令（全厂一套，勿叠配） */
export const BATCH_BRANCH_HANDLE_MODES = {
  SAME_BATCH: 'same_batch',
  SPAWN_ORDER: 'spawn_order',
  BOTH: 'both',
}

export const BATCH_BRANCH_HANDLE_MODE_OPTIONS = [
  {
    value: BATCH_BRANCH_HANDLE_MODES.SAME_BATCH,
    label: '仅同批关支线（一张批令里关掉不做的支线阶段）',
  },
  {
    value: BATCH_BRANCH_HANDLE_MODES.SPAWN_ORDER,
    label: '仅另开指令（登产出后开下游批令）',
  },
  {
    value: BATCH_BRANCH_HANDLE_MODES.BOTH,
    label: '两者都开（需业务自行避免同一条支线叠配）',
  },
]

export const BATCH_BRANCH_HANDLE_MODE_DESCRIPTION =
  '一条物理支线建议只走一种：同槽顺手做用「仅同批关支线」；独立排产/追溯用「仅另开指令」。' +
  '选「仅××」时会关掉另一套入口，避免两条路叠在同一条渣线上。'

export function normalizeBatchBranchHandleMode(value) {
  const text = String(value || '').trim()
  if (text === BATCH_BRANCH_HANDLE_MODES.SAME_BATCH) return BATCH_BRANCH_HANDLE_MODES.SAME_BATCH
  if (text === BATCH_BRANCH_HANDLE_MODES.SPAWN_ORDER) return BATCH_BRANCH_HANDLE_MODES.SPAWN_ORDER
  return BATCH_BRANCH_HANDLE_MODES.BOTH
}

export const PROCESS_ROUTE_MODE_DESCRIPTION =
  '工艺路线：格子是工序，每格再挂设备，渣/母液回流写回到哪一格。' +
  '设备顺序：只排设备，配方阶段仍选工序，设备从这条顺序里选。' +
  '只影响之后新增的路线；已有路线按保存时的模式打开。'

export { ROUTE_MODE_OPTIONS as PROCESS_ROUTE_MODE_OPTIONS }

/**
 * 流程型投料扣减：新料 / 回流可分别配置；投料来源在行上选。
 * LOCATION_FIFO 存档键仍为 location_fifo（兼容旧数据），业务含义是库位内 FEFO（近效先出）。
 */
export const PROCESS_FEED_DEDUCT_MODES = {
  BATCH_PICK: 'batch_pick',
  LOCATION_FIFO: 'location_fifo',
  EITHER: 'either',
}

export const PROCESS_FEED_DEDUCT_OPTIONS = [
  { value: PROCESS_FEED_DEDUCT_MODES.BATCH_PICK, label: '选手选批次' },
  { value: PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO, label: '按库位/储罐近效先出（FEFO）' },
  { value: PROCESS_FEED_DEDUCT_MODES.EITHER, label: '两者皆可' },
]

export const PROCESS_FEED_DEDUCT_FRESH_DESCRIPTION =
  '控制「线边新料」行怎么扣：选手选批次 / 只选储罐或库位按近效先出（FEFO：失效日期近的先扣，过期批不参与） / 两者皆可（选了批按批扣，未选批须选位置）。' +
  'FEFO 时有效含量可手填或空着后补。投料来源在明细行选择，不在表头统一。'

export const PROCESS_FEED_DEDUCT_RECYCLE_DESCRIPTION =
  '控制「回流料」行怎么扣：选手选批次（默认）/ 回用罐+量近效先出（FEFO） / 两者皆可。' +
  'FEFO 只扣待回用池中落在所选回用罐上的量。再提指令仍强制选手选批次，不受本项影响。'

/** @deprecated 文案兼容，等同新料说明 */
export const PROCESS_FEED_DEDUCT_DESCRIPTION = PROCESS_FEED_DEDUCT_FRESH_DESCRIPTION

export function normalizeProcessFeedDeductMode(value) {
  const text = String(value || '').trim()
  if (text === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO) {
    return PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO
  }
  if (text === PROCESS_FEED_DEDUCT_MODES.EITHER || text === 'both' || text === 'either_ok') {
    return PROCESS_FEED_DEDUCT_MODES.EITHER
  }
  return PROCESS_FEED_DEDUCT_MODES.BATCH_PICK
}

export const FUNCTION_PARAM_ROWS = [
  {
    key: 'autoApproveDocs',
    category: 'automation',
    scenario: '自动审批配置',
    description: AUTO_APPROVE_DESCRIPTION,
  },
  {
    key: 'enableBomApprove',
    category: 'bom',
    scenario: 'BOM 生效唯一性',
    description: ENABLE_BOM_APPROVE_DESCRIPTION,
    displayOnly: true,
    controlType: 'switch',
  },
  {
    key: 'processFileSelectMode',
    category: 'bom',
    scenario: '工艺文件管理方式',
    description: PROCESS_FILE_SELECT_DESCRIPTION,
    displayOnly: true,
    controlType: 'radio',
    options: PROCESS_FILE_SELECT_OPTIONS,
  },
  {
    key: 'inventoryDeductMode',
    category: 'inventory',
    scenario: '库存扣减',
    description: INVENTORY_DEDUCT_DESCRIPTION,
  },
  {
    key: 'outboundIssueRule',
    category: 'inventory',
    scenario: '出库规则',
    description: OUTBOUND_ISSUE_RULE_DESCRIPTION,
  },
  {
    key: 'workshopStagingMergeContentMode',
    category: 'inventory',
    scenario: '车间暂存合并含量',
    description: WORKSHOP_STAGING_MERGE_CONTENT_DESCRIPTION,
  },
  {
    key: 'transferRequireInboundConfirm',
    category: 'inventory',
    scenario: '调拨入库方签收',
    description: TRANSFER_REQUIRE_INBOUND_CONFIRM_DESCRIPTION,
  },
  {
    key: 'stocktakeAutoPostOnApprove',
    category: 'inventory',
    scenario: '盘点审核通过后过账',
    description: STOCKTAKE_AUTO_POST_ON_APPROVE_DESCRIPTION,
  },
  {
    key: 'enableSalesOrderDiscount',
    category: 'sales',
    scenario: '销售订单价格折扣',
    description: ENABLE_SALES_ORDER_DISCOUNT_DESCRIPTION,
  },
  {
    key: 'salesOrderStockFulfillmentDefault',
    category: 'sales',
    scenario: '销售订单库存履约默认值',
    description: SALES_ORDER_STOCK_FULFILLMENT_DEFAULT_DESCRIPTION,
  },
  {
    key: 'paymentLinkMode',
    category: 'sales',
    scenario: '回款挂接对象',
    description: PAYMENT_LINK_MODE_DESCRIPTION,
  },
  {
    key: 'processRouteMode',
    category: 'production',
    scenario: '工艺路线模式',
    description: PROCESS_ROUTE_MODE_DESCRIPTION,
  },
  {
    key: 'processFeedDeductMode',
    category: 'production',
    scenario: '新料投料扣减',
    description: PROCESS_FEED_DEDUCT_FRESH_DESCRIPTION,
  },
  {
    key: 'processFeedDeductModeRecycle',
    category: 'production',
    scenario: '回流投料扣减',
    description: PROCESS_FEED_DEDUCT_RECYCLE_DESCRIPTION,
  },
  {
    key: 'enableSequentialBatchStep',
    category: 'production',
    scenario: '批次阶段时序确认',
    description: ENABLE_SEQUENTIAL_BATCH_STEP_DESCRIPTION,
    controlType: 'switch',
  },
  {
    key: 'batchBranchHandleMode',
    category: 'production',
    scenario: '支线处理方式',
    description: BATCH_BRANCH_HANDLE_MODE_DESCRIPTION,
    controlType: 'radio',
    options: BATCH_BRANCH_HANDLE_MODE_OPTIONS,
  },
  {
    key: 'salaryPushMode',
    category: 'production',
    scenario: '工资推送',
    description: SALARY_PUSH_DESCRIPTION,
  },
  {
    key: 'wechatMessagePush',
    category: 'message',
    scenario: '微信消息推送',
    description: WECHAT_MESSAGE_PUSH_DESCRIPTION,
    displayOnly: true,
    controlType: 'switch',
  },
]

/** 按分类组装：导航 + 分组列表 */
export function getFunctionParamCategoryGroups() {
  return FUNCTION_PARAM_CATEGORIES.map((cat) => ({
    ...cat,
    rows: FUNCTION_PARAM_ROWS.filter((row) => row.category === cat.key),
  })).filter((cat) => cat.rows.length > 0)
}

function normalizeSalaryPushMode(mode) {
  if (mode === 'auto') return SALARY_PUSH_MODES.ON_REPORT
  if (SALARY_PUSH_OPTIONS.some((item) => item.value === mode)) return mode
  return SALARY_PUSH_MODES.MANUAL
}

function normalizeInventoryDeductMode(mode) {
  // 兼容旧值「按计划数量扣」
  if (mode === 'post_complete_by_plan') return INVENTORY_DEDUCT_MODES.POST_COMPLETE_BY_REPORT
  if (INVENTORY_DEDUCT_OPTIONS.some((item) => item.value === mode)) return mode
  return INVENTORY_DEDUCT_MODES.NO_ISSUE
}

function normalizeOutboundIssueRule(mode) {
  const text = String(mode || '').trim()
  // 旧 FIFO / LIFO 一律升为 FEFO（近效先出）
  if (text === OUTBOUND_ISSUE_RULES.FIFO || text === OUTBOUND_ISSUE_RULES.LIFO) {
    return OUTBOUND_ISSUE_RULES.FEFO
  }
  if (OUTBOUND_ISSUE_RULE_OPTIONS.some((item) => item.value === text)) return text
  return OUTBOUND_ISSUE_RULES.EITHER
}

function normalizeWorkshopStagingMergeContentMode(mode) {
  const hit = WORKSHOP_STAGING_MERGE_CONTENT_OPTIONS.find((item) => item.value === mode)
  if (hit && !hit.disabled) return hit.value
  return WORKSHOP_STAGING_MERGE_CONTENT_MODES.SAME
}

function normalizeSalesOutboundIssueRule(mode) {
  if (SALES_OUTBOUND_ISSUE_RULE_OPTIONS.some((item) => item.value === mode)) return mode
  return SALES_OUTBOUND_ISSUE_RULES.BY_ORDER
}

function normalizeShipAttachmentDecideStage(mode) {
  // 仓管环节暂隐藏：历史配置自动回落到「申请发货时确定」
  if (mode === SHIP_ATTACHMENT_DECIDE_STAGES.WAREHOUSE) {
    return SHIP_ATTACHMENT_DECIDE_STAGES.APPLY
  }
  if (SHIP_ATTACHMENT_DECIDE_STAGE_OPTIONS.some((item) => item.value === mode)) return mode
  return SHIP_ATTACHMENT_DECIDE_STAGES.APPLY
}

/** 兼容旧版调拨页工具栏开关（i_doms_transfer_settings） */
function readLegacyTransferRequireInboundConfirm() {
  try {
    const raw = localStorage.getItem('i_doms_transfer_settings')
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    const v = parsed?.settings?.requireInboundConfirm
    if (typeof v === 'boolean') return v
  } catch {
    /* ignore */
  }
  return undefined
}

function normalizeTransferRequireInboundConfirm(value, legacyFallback) {
  if (typeof value === 'boolean') return value
  if (typeof legacyFallback === 'boolean') return legacyFallback
  return true
}

/** 兼容旧版盘点页工具栏开关（i_doms_stocktake_settings） */
function readLegacyStocktakeAutoPostOnApprove() {
  try {
    const raw = localStorage.getItem('i_doms_stocktake_settings')
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    const v = parsed?.settings?.autoPostOnApprove
    if (typeof v === 'boolean') return v
  } catch {
    /* ignore */
  }
  return undefined
}

function normalizeStocktakeAutoPostOnApprove(value, legacyFallback) {
  if (typeof value === 'boolean') return value
  if (typeof legacyFallback === 'boolean') return legacyFallback
  return true
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const legacyTransferConfirm = readLegacyTransferRequireInboundConfirm()
        return {
          ...parsed,
          salaryPushMode: normalizeSalaryPushMode(parsed.salaryPushMode),
          autoGenerateDocs: normalizeAutoGenerateDocs(parsed.autoGenerateDocs),
          autoApproveDocs: normalizeAutoApproveDocs(parsed.autoApproveDocs),
          inventoryDeductMode: normalizeInventoryDeductMode(parsed.inventoryDeductMode),
          outboundIssueRule: normalizeOutboundIssueRule(parsed.outboundIssueRule),
          workshopStagingMergeContentMode: normalizeWorkshopStagingMergeContentMode(
            parsed.workshopStagingMergeContentMode,
          ),
          salesOutboundIssueRule: normalizeSalesOutboundIssueRule(parsed.salesOutboundIssueRule),
          shipAttachmentDecideStage: normalizeShipAttachmentDecideStage(
            parsed.shipAttachmentDecideStage,
          ),
          transferRequireInboundConfirm: normalizeTransferRequireInboundConfirm(
            parsed.transferRequireInboundConfirm,
            legacyTransferConfirm,
          ),
          stocktakeAutoPostOnApprove: normalizeStocktakeAutoPostOnApprove(
            parsed.stocktakeAutoPostOnApprove,
            readLegacyStocktakeAutoPostOnApprove(),
          ),
          dualUnitIssueStrategy: DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL,
          blankSizeAssistTools: createDefaultBlankSizeAssistTools(),
          blankSizeAssistToolsVersion: BLANK_SIZE_ASSIST_DEFAULTS_VERSION,
          enableBomLevelMts: false,
          enableSequentialProcessTask: false,
          enableSequentialBatchStep: Boolean(parsed.enableSequentialBatchStep),
          batchBranchHandleMode: normalizeBatchBranchHandleMode(parsed.batchBranchHandleMode),
          processRouteMode: normalizeRouteMode(
            parsed.processRouteMode ?? readLegacyProcessRouteMode(),
          ),
          processFeedDeductMode: normalizeProcessFeedDeductMode(parsed.processFeedDeductMode),
          processFeedDeductModeRecycle: normalizeProcessFeedDeductMode(
            parsed.processFeedDeductModeRecycle,
          ),
          enableSalesOrderDiscount: parsed.enableSalesOrderDiscount !== false,
          salesOrderStockFulfillmentDefault: normalizeSalesOrderStockFulfillmentDefault(
            parsed.salesOrderStockFulfillmentDefault,
          ),
          paymentLinkMode: normalizePaymentLinkMode(parsed.paymentLinkMode),
          qcDefaultGatePolicy: normalizeQcGatePolicyParam(parsed.qcDefaultGatePolicy),
          qcGatePolicyByBizScope: normalizeQcGatePolicyMap(parsed.qcGatePolicyByBizScope),
          displayParams: normalizeDisplayParams(parsed.displayParams),
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  persistJson(STORAGE_KEY, functionParamState.params)
}

/** 显式保存当前功能参数（页头「保存」按钮） */
export function saveFunctionParams() {
  persist()
  return { ok: true }
}

export const functionParamState = reactive({
  params: loadFromStorage() || {
    salaryPushMode: SALARY_PUSH_MODES.MANUAL,
    autoGenerateDocs: createDefaultAutoGenerateDocs(),
    autoApproveDocs: createDefaultAutoApproveDocs(),
    inventoryDeductMode: INVENTORY_DEDUCT_MODES.NO_ISSUE,
    outboundIssueRule: OUTBOUND_ISSUE_RULES.EITHER,
    workshopStagingMergeContentMode: WORKSHOP_STAGING_MERGE_CONTENT_MODES.SAME,
    salesOutboundIssueRule: SALES_OUTBOUND_ISSUE_RULES.BY_ORDER,
    shipAttachmentDecideStage: SHIP_ATTACHMENT_DECIDE_STAGES.APPLY,
    transferRequireInboundConfirm: normalizeTransferRequireInboundConfirm(
      undefined,
      readLegacyTransferRequireInboundConfirm(),
    ),
    stocktakeAutoPostOnApprove: normalizeStocktakeAutoPostOnApprove(
      undefined,
      readLegacyStocktakeAutoPostOnApprove(),
    ),
    dualUnitIssueStrategy: DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL,
    blankSizeAssistTools: createDefaultBlankSizeAssistTools(),
    blankSizeAssistToolsVersion: BLANK_SIZE_ASSIST_DEFAULTS_VERSION,
    enableBomLevelMts: false,
    enableSequentialProcessTask: false,
    enableSequentialBatchStep: false,
    batchBranchHandleMode: BATCH_BRANCH_HANDLE_MODES.BOTH,
    processRouteMode: normalizeRouteMode(readLegacyProcessRouteMode()) || ROUTE_MODE_PROCESS,
    processFeedDeductMode: PROCESS_FEED_DEDUCT_MODES.BATCH_PICK,
    processFeedDeductModeRecycle: PROCESS_FEED_DEDUCT_MODES.BATCH_PICK,
    enableSalesOrderDiscount: true,
    salesOrderStockFulfillmentDefault: STOCK_FULFILLMENT_MODE.PREFER_STOCK,
    paymentLinkMode: PAYMENT_LINK_MODES.BOTH,
    qcDefaultGatePolicy: 'soft',
    qcGatePolicyByBizScope: normalizeQcGatePolicyMap(),
    displayParams: createDefaultDisplayParams(),
  },
})

watch(
  () => functionParamState.params,
  () => persist(),
  { deep: true },
)

export function getSalaryPushMode() {
  return normalizeSalaryPushMode(functionParamState.params.salaryPushMode)
}

export function setSalaryPushMode(mode) {
  const normalized = normalizeSalaryPushMode(mode)
  const hit = SALARY_PUSH_OPTIONS.find((item) => item.value === normalized)
  if (!hit) return { ok: false, message: '无效的推送方式' }
  functionParamState.params.salaryPushMode = normalized
  return { ok: true }
}

export function isReportSalaryPush() {
  return getSalaryPushMode() === SALARY_PUSH_MODES.ON_REPORT
}

export function isAuditSalaryPush() {
  return getSalaryPushMode() === SALARY_PUSH_MODES.ON_AUDIT
}

export function isManualSalaryPush() {
  return getSalaryPushMode() === SALARY_PUSH_MODES.MANUAL
}

export function getAutoGenerateDocs() {
  return normalizeAutoGenerateDocs(functionParamState.params.autoGenerateDocs)
}

export function setAutoGenerateDocs(enabledKeys = []) {
  const keys = Array.isArray(enabledKeys) ? enabledKeys : []
  functionParamState.params.autoGenerateDocs = normalizeAutoGenerateDocs(
    Object.fromEntries(
      AUTO_GENERATE_DOC_OPTIONS.map((item) => [item.value, keys.includes(item.value)]),
    ),
  )
  return { ok: true }
}

export function isAutoGenerateDocEnabled(type) {
  return Boolean(getAutoGenerateDocs()[type])
}

export function getAutoApproveDocs() {
  return normalizeAutoApproveDocs(functionParamState.params.autoApproveDocs)
}

export function setAutoApproveDocs(enabledKeys = []) {
  const keys = Array.isArray(enabledKeys) ? enabledKeys : []
  functionParamState.params.autoApproveDocs = normalizeAutoApproveDocs(
    Object.fromEntries(AUTO_APPROVE_OPTIONS.map((item) => [item.value, keys.includes(item.value)])),
  )
  return { ok: true }
}

export function isAutoApproveEnabled(type) {
  return Boolean(getAutoApproveDocs()[type])
}

export function getInventoryDeductMode() {
  return normalizeInventoryDeductMode(functionParamState.params.inventoryDeductMode)
}

export function setInventoryDeductMode(mode) {
  const normalized = normalizeInventoryDeductMode(mode)
  const hit = INVENTORY_DEDUCT_OPTIONS.find((item) => item.value === normalized)
  if (!hit) return { ok: false, message: '无效的库存扣减方式' }
  functionParamState.params.inventoryDeductMode = normalized
  return { ok: true }
}

export function isInventoryNoIssue() {
  return getInventoryDeductMode() === INVENTORY_DEDUCT_MODES.NO_ISSUE
}

export function isInventoryDeductByPlan() {
  return getInventoryDeductMode() === INVENTORY_DEDUCT_MODES.POST_COMPLETE_BY_REPORT
}

export function isInventoryDeductByReport() {
  return getInventoryDeductMode() === INVENTORY_DEDUCT_MODES.POST_COMPLETE_BY_REPORT
}

export function isInventoryDeductByActual() {
  return getInventoryDeductMode() === INVENTORY_DEDUCT_MODES.SELF_ISSUE_BY_ACTUAL
}

export function getOutboundIssueRule() {
  return normalizeOutboundIssueRule(functionParamState.params.outboundIssueRule)
}

export function getWorkshopStagingMergeContentMode() {
  return normalizeWorkshopStagingMergeContentMode(
    functionParamState.params.workshopStagingMergeContentMode,
  )
}

export function setWorkshopStagingMergeContentMode(mode) {
  const normalized = normalizeWorkshopStagingMergeContentMode(mode)
  const hit = WORKSHOP_STAGING_MERGE_CONTENT_OPTIONS.find((item) => item.value === normalized)
  if (!hit || hit.disabled) {
    return { ok: false, message: '本期仅开放「含量须相同才可合」' }
  }
  functionParamState.params.workshopStagingMergeContentMode = normalized
  return { ok: true }
}

export function setOutboundIssueRule(mode) {
  const normalized = normalizeOutboundIssueRule(mode)
  if (!OUTBOUND_ISSUE_RULE_OPTIONS.some((item) => item.value === normalized)) {
    return { ok: false, message: '无效的出库规则' }
  }
  functionParamState.params.outboundIssueRule = normalized
  return { ok: true }
}

/** 强制自主选批（不可走自动 FEFO） */
export function isManualOutboundIssue() {
  return getOutboundIssueRule() === OUTBOUND_ISSUE_RULES.MANUAL
}

/** 仅 FEFO 自动扣批（行上不可自主改批） */
export function isAutoOutboundIssue() {
  return getOutboundIssueRule() === OUTBOUND_ISSUE_RULES.FEFO
}

/** FEFO 与自主选批皆可（默认自动，行上可改手选） */
export function isEitherOutboundIssue() {
  return getOutboundIssueRule() === OUTBOUND_ISSUE_RULES.EITHER
}

/** 是否允许行上出现「自主拣选」入口 */
export function canOutboundManualBatchPick() {
  const rule = getOutboundIssueRule()
  return rule === OUTBOUND_ISSUE_RULES.MANUAL || rule === OUTBOUND_ISSUE_RULES.EITHER
}

export function getSalesOutboundIssueRule() {
  return normalizeSalesOutboundIssueRule(functionParamState.params.salesOutboundIssueRule)
}

export function setSalesOutboundIssueRule(mode) {
  const normalized = normalizeSalesOutboundIssueRule(mode)
  if (!SALES_OUTBOUND_ISSUE_RULE_OPTIONS.some((item) => item.value === normalized)) {
    return { ok: false, message: '无效的发货出库规则' }
  }
  functionParamState.params.salesOutboundIssueRule = normalized
  return { ok: true }
}

/** 销售发货是否按单扣批（禁止全仓 FIFO 抢他单按单库存） */
export function isSalesOutboundByOrder() {
  return getSalesOutboundIssueRule() === SALES_OUTBOUND_ISSUE_RULES.BY_ORDER
}

export function getShipAttachmentDecideStage() {
  return normalizeShipAttachmentDecideStage(functionParamState.params.shipAttachmentDecideStage)
}

export function setShipAttachmentDecideStage(mode) {
  const normalized = normalizeShipAttachmentDecideStage(mode)
  if (!SHIP_ATTACHMENT_DECIDE_STAGE_OPTIONS.some((item) => item.value === normalized)) {
    return { ok: false, message: '无效的随货配件确定环节' }
  }
  functionParamState.params.shipAttachmentDecideStage = normalized
  return { ok: true }
}

/** 调拨是否需入库方签收（默认需要） */
export function isTransferRequireInboundConfirm() {
  return normalizeTransferRequireInboundConfirm(
    functionParamState.params.transferRequireInboundConfirm,
  )
}

export function setTransferRequireInboundConfirm(value) {
  functionParamState.params.transferRequireInboundConfirm = Boolean(value)
  return { ok: true }
}

/** 盘点审核通过后是否自动过账（默认自动） */
export function isStocktakeAutoPostOnApprove() {
  return normalizeStocktakeAutoPostOnApprove(functionParamState.params.stocktakeAutoPostOnApprove)
}

export function setStocktakeAutoPostOnApprove(value) {
  functionParamState.params.stocktakeAutoPostOnApprove = Boolean(value)
  return { ok: true }
}

/** 随货配件能力是否启用（非「关闭」） */
export function isShipAttachmentFeatureEnabled() {
  return getShipAttachmentDecideStage() !== SHIP_ATTACHMENT_DECIDE_STAGES.OFF
}

/** 销售订单时即确定随货配件 */
export function isShipAttachmentDecidedAtOrder() {
  return getShipAttachmentDecideStage() === SHIP_ATTACHMENT_DECIDE_STAGES.ORDER
}

/** 销售申请发货时确定附件（展示申请页附件能力；含订单时确定） */
export function isShipAttachmentDecidedAtApply() {
  const stage = getShipAttachmentDecideStage()
  return (
    stage === SHIP_ATTACHMENT_DECIDE_STAGES.APPLY || stage === SHIP_ATTACHMENT_DECIDE_STAGES.ORDER
  )
}

/** 仓管发货时才确定附件（申请页隐藏，随货查询可维护） */
export function isShipAttachmentDecidedAtWarehouse() {
  return getShipAttachmentDecideStage() === SHIP_ATTACHMENT_DECIDE_STAGES.WAREHOUSE
}

export function getDualUnitIssueStrategy() {
  return DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL
}

export function setDualUnitIssueStrategy() {
  functionParamState.params.dualUnitIssueStrategy = DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL
  return { ok: true }
}

/** 全局「是否需要下料结算」是否为无需结算（仅作用于需下料结算能力物料） */
export function isPartialDualUnitIssue() {
  return getDualUnitIssueStrategy() === DUAL_UNIT_ISSUE_STRATEGIES.PARTIAL
}

/** 全局「是否需要下料结算」是否为需结算回库（仅作用于需下料结算能力物料） */
export function isWholeWithRemnantIssue() {
  return getDualUnitIssueStrategy() === DUAL_UNIT_ISSUE_STRATEGIES.WHOLE_WITH_REMNANT
}

/** 下料/订货尺寸辅助勾选项 */
export function getBlankSizeAssistTools() {
  return normalizeBlankSizeAssistTools(functionParamState.params.blankSizeAssistTools, {
    enablePlateAreaMeasure: functionParamState.params.enablePlateAreaMeasure,
    enableBomWeightCalc: functionParamState.params.enableBomWeightCalc,
  })
}

export function setBlankSizeAssistTools() {
  functionParamState.params.blankSizeAssistTools = createDefaultBlankSizeAssistTools()
  functionParamState.params.blankSizeAssistToolsVersion = BLANK_SIZE_ASSIST_DEFAULTS_VERSION
  delete functionParamState.params.enablePlateAreaMeasure
  delete functionParamState.params.enableBomWeightCalc
  return { ok: true }
}

/** 是否开放面积换算（下料尺寸 / 订货尺寸 / 入库长×宽；默认开） */
export function isPlateAreaMeasureEnabled() {
  return false
}

export function setEnablePlateAreaMeasure(enabled) {
  const current = getBlankSizeAssistTools()
  const next = {
    ...current,
    [BLANK_SIZE_ASSIST_TYPES.PLATE_AREA_MEASURE]: Boolean(enabled),
  }
  return setBlankSizeAssistTools(
    BLANK_SIZE_ASSIST_OPTIONS.filter((item) => next[item.value]).map((item) => item.value),
  )
}

/** 是否开放「重量计算」页签（BOM 下料尺寸 / 采购订货尺寸；默认开） */
export function isBomWeightCalcEnabled() {
  return false
}

export function setEnableBomWeightCalc(enabled) {
  const current = getBlankSizeAssistTools()
  const next = {
    ...current,
    [BLANK_SIZE_ASSIST_TYPES.BOM_WEIGHT_CALC]: Boolean(enabled),
  }
  return setBlankSizeAssistTools(
    BLANK_SIZE_ASSIST_OPTIONS.filter((item) => next[item.value]).map((item) => item.value),
  )
}

/** 生产计划是否启用 BOM 级 MTS（子件可按库存跳过排产） */
export function isBomLevelMtsEnabled() {
  return false
}

/** 工序任务是否按时序下发（上道报工完成后才放开下道） */
export function isSequentialProcessTaskEnabled() {
  return false
}

export function setEnableSequentialProcessTask() {
  functionParamState.params.enableSequentialProcessTask = false
  return { ok: true }
}

/** 批次指令工艺阶段是否按时序确认（上一步确认后才可确认下一步） */
export function isSequentialBatchStepEnabled() {
  return Boolean(functionParamState.params.enableSequentialBatchStep)
}

export function setEnableSequentialBatchStep(enabled) {
  functionParamState.params.enableSequentialBatchStep = Boolean(enabled)
  return { ok: true }
}

/** 支线处理方式（全厂一套） */
export function getBatchBranchHandleMode() {
  return normalizeBatchBranchHandleMode(functionParamState.params.batchBranchHandleMode)
}

export function setBatchBranchHandleMode(mode) {
  functionParamState.params.batchBranchHandleMode = normalizeBatchBranchHandleMode(mode)
  return { ok: true }
}

/** 是否允许批令上「本次启用」关支线阶段 */
export function isSameBatchBranchSkipEnabled() {
  const mode = getBatchBranchHandleMode()
  return mode === BATCH_BRANCH_HANDLE_MODES.SAME_BATCH || mode === BATCH_BRANCH_HANDLE_MODES.BOTH
}

/** 是否允许配方产出「生成下游指令 / 开支线子令」 */
export function isSpawnBranchOrderEnabled() {
  const mode = getBatchBranchHandleMode()
  return mode === BATCH_BRANCH_HANDLE_MODES.SPAWN_ORDER || mode === BATCH_BRANCH_HANDLE_MODES.BOTH
}

function readLegacyProcessRouteMode() {
  try {
    const raw = localStorage.getItem('i-doms-process-mes-settings-v1')
    if (!raw) return ROUTE_MODE_PROCESS
    const parsed = JSON.parse(raw)
    return normalizeRouteMode(parsed?.routeMode)
  } catch {
    return ROUTE_MODE_PROCESS
  }
}

export function getProcessRouteMode() {
  return normalizeRouteMode(functionParamState.params.processRouteMode)
}

export function setProcessRouteMode(value) {
  functionParamState.params.processRouteMode = normalizeRouteMode(value)
}

/** 新料投料扣减（兼容旧键 processFeedDeductMode） */
export function getProcessFeedDeductMode() {
  return normalizeProcessFeedDeductMode(functionParamState.params.processFeedDeductMode)
}

export function setProcessFeedDeductMode(value) {
  functionParamState.params.processFeedDeductMode = normalizeProcessFeedDeductMode(value)
  return { ok: true }
}

/** 回流投料扣减 */
export function getProcessFeedDeductModeRecycle() {
  return normalizeProcessFeedDeductMode(functionParamState.params.processFeedDeductModeRecycle)
}

export function setProcessFeedDeductModeRecycle(value) {
  functionParamState.params.processFeedDeductModeRecycle = normalizeProcessFeedDeductMode(value)
  return { ok: true }
}

/** @param {'fresh'|'recycle'|string} source */
export function getFeedDeductModeForSource(source) {
  if (source === 'recycle') return getProcessFeedDeductModeRecycle()
  return getProcessFeedDeductMode()
}

/** 强制仅库位近效先出（FEFO；存档模式 location_fifo） */
export function isProcessFeedLocationFifo(source = 'fresh') {
  return getFeedDeductModeForSource(source) === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO
}

/** 两者皆可 */
export function isProcessFeedEitherMode(source = 'fresh') {
  return getFeedDeductModeForSource(source) === PROCESS_FEED_DEDUCT_MODES.EITHER
}

/** 允许库位 FEFO 扣减（强制 FEFO 或两者皆可） */
export function allowsProcessFeedFifo(source = 'fresh') {
  const mode = getFeedDeductModeForSource(source)
  return (
    mode === PROCESS_FEED_DEDUCT_MODES.LOCATION_FIFO || mode === PROCESS_FEED_DEDUCT_MODES.EITHER
  )
}

/** 销售订单是否启用价格折扣（策略 / 行折扣 / 整单优惠） */
export function isSalesOrderDiscountEnabled() {
  return functionParamState.params.enableSalesOrderDiscount !== false
}

export function setEnableSalesOrderDiscount(enabled) {
  functionParamState.params.enableSalesOrderDiscount = Boolean(enabled)
  return { ok: true }
}

/** 新建销售订单明细「库存履约」默认值 */
export function getSalesOrderStockFulfillmentDefault() {
  return normalizeSalesOrderStockFulfillmentDefault(
    functionParamState.params.salesOrderStockFulfillmentDefault,
  )
}

export function setSalesOrderStockFulfillmentDefault(mode) {
  const normalized = normalizeSalesOrderStockFulfillmentDefault(mode)
  functionParamState.params.salesOrderStockFulfillmentDefault = normalized
  return { ok: true }
}

export function getPaymentLinkMode() {
  return normalizePaymentLinkMode(functionParamState.params.paymentLinkMode)
}

export function setPaymentLinkMode(mode) {
  const normalized = normalizePaymentLinkMode(mode)
  functionParamState.params.paymentLinkMode = normalized
  return { ok: true }
}

export function isPaymentLinkBoth() {
  return getPaymentLinkMode() === PAYMENT_LINK_MODES.BOTH
}

export function isPaymentLinkOrderMode() {
  return getPaymentLinkMode() === PAYMENT_LINK_MODES.ORDER
}

export function setEnableBomLevelMts() {
  functionParamState.params.enableBomLevelMts = false
  return { ok: true }
}

export function getQcDefaultGatePolicy() {
  return normalizeQcGatePolicyParam(functionParamState.params.qcDefaultGatePolicy)
}

export function setQcDefaultGatePolicy(value) {
  const v = normalizeQcGatePolicyParam(value)
  functionParamState.params.qcDefaultGatePolicy = v
  return { ok: true }
}

export function getQcGatePolicyByBizScope(bizScope) {
  const scope = String(bizScope || '').trim()
  const map = functionParamState.params.qcGatePolicyByBizScope || {}
  if (scope && map[scope]) return normalizeQcGatePolicyParam(map[scope])
  return getQcDefaultGatePolicy()
}

export function setQcGatePolicyByBizScope(bizScope, policy) {
  const scope = String(bizScope || '').trim()
  if (!scope) return { ok: false, message: 'bizScope 不能为空' }
  const normalized = normalizeQcGatePolicyParam(policy)
  const hit = QC_GATE_POLICY_PARAM_OPTIONS.find((o) => o.value === String(policy || '').trim())
  if (hit?.disabled || (String(policy || '').trim() === 'hard' && normalized === 'soft')) {
    return { ok: false, message: '当期仅开放弱管控，强管控后续开放' }
  }
  if (!functionParamState.params.qcGatePolicyByBizScope) {
    functionParamState.params.qcGatePolicyByBizScope = normalizeQcGatePolicyMap()
  }
  functionParamState.params.qcGatePolicyByBizScope[scope] = normalized
  functionParamState.params.qcDefaultGatePolicy = 'soft'
  return { ok: true }
}

export function getQcGatePolicyMap() {
  return normalizeQcGatePolicyMap(functionParamState.params.qcGatePolicyByBizScope)
}

export function setQcGatePolicyMap(map = {}) {
  functionParamState.params.qcGatePolicyByBizScope = normalizeQcGatePolicyMap(map)
  functionParamState.params.qcDefaultGatePolicy = 'soft'
  return { ok: true }
}

/** 展示项参数（不驱动业务逻辑，仅功能参数页可改） */
export function getDisplayParams() {
  return normalizeDisplayParams(functionParamState.params.displayParams)
}

export function getDisplayParam(key, fallback) {
  const map = getDisplayParams()
  if (Object.prototype.hasOwnProperty.call(map, key)) return map[key]
  return fallback
}

export function setDisplayParam(key, value) {
  const k = String(key || '').trim()
  if (!k) return { ok: false, message: '参数 key 不能为空' }
  functionParamState.params.displayParams = {
    ...getDisplayParams(),
    [k]: value,
  }
  return { ok: true }
}

/** @deprecated 使用 isReportSalaryPush */
export function isAutoSalaryPush() {
  return isReportSalaryPush()
}
