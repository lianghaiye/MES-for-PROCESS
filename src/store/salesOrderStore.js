import { reactive, watch } from 'vue'
import dayjs from 'dayjs'
import { getOwnActiveBomForItem } from '@/store/productBomStore'
import {
  BOM_FULFILLMENT_PATH,
  normalizeBomFulfillmentPath,
  validateFulfillmentPathForApprove,
} from '@/constants/salesOrderFulfillment'
import { createProductionPlanFromSalesOrder } from '@/store/productionPlanStore'
import { buildEbomSnapshotFromBom } from '@/utils/ebomSnapshot'
import { buildLineAccessoryKits, buildOrderAccessoryKits } from '@/mock/accessoryPacks'
import { normalizeDeliveryMode } from '@/utils/salesDeliveryMode'
import {
  ensureEcnDemoBootstrap,
  isEcnDemoSalesOrder,
  buildEcnDemoSalesOrderApprovalRecords,
} from '@/mock/ecnDemoBootstrap'
import { hydrateApprovedSelfProdOrders } from '@/utils/hydrateSalesLines'
import { validateChangeDeliveryRows, applyDeliveryModeChanges } from '@/utils/changeDeliveryMode'
import { syncProductionPlanDeliveryMode } from '@/store/productionPlanStore'
import { applyOrderAmounts } from '@/utils/salesOrderPricing'
import {
  deriveOrderBusinessType,
  isOutsourcingBusinessType,
  isPurchasedBusinessType,
  isCustomSalesBusinessType,
  isSelfMadeBusinessType,
  isMaintenanceServiceBusinessType,
  normalizeSalesLineBusiness,
  resolveLineBusinessType,
} from '@/utils/salesOrderBusiness'
import { createOutsourcingWorkOrdersFromSalesOrder } from '@/utils/salesOrderOutsourceWorkOrder'
import { createMaintenanceWorkOrdersFromSalesOrder } from '@/utils/salesOrderMaintenanceWorkOrder'
import { createDesignTaskFromSalesLine } from '@/store/designTaskStore'
import {
  createLabelRequestFromSalesOrder,
  applyLabelSummaryToSalesLines,
  voidLabelsBySalesOrder,
  salesOrderHasBoundLabels,
  salesLineIndustrialLabelNeedQty,
} from '@/store/industrialLabelStore'
import { isCustomProductAttribute } from '@/constants/designTask'
import { productInfoState } from '@/store/productInfoStore'
import { validateSalesLinesSkuResolved } from '@/utils/spuLineResolve'
import {
  allocateStockOnSalesApprove,
  buildLineStockReminder,
  buildOrderInventoryStatus,
  getLineAllocatedQty,
  releaseOrderAllocations,
} from '@/store/salesStockAllocationStore'
import {
  buildLineStockFulfillmentPlan,
  listStockOnlyShortfalls,
  normalizeStockFulfillmentMode,
  stockFulfillmentModeLabel,
} from '@/utils/salesStockFulfillment'
import {
  hasSalesOrderRevokeBlockers,
  SALES_ORDER_REVOKE_BLOCKED_MESSAGE,
} from '@/utils/salesOrderRevokeApproval'
import {
  isSalesOrderApproved,
  normalizeSalesOrderProgressStatus,
  SALES_ORDER_STATUS,
} from '@/utils/salesOrderStatus'
import { persistJson } from '@/utils/safeStorage'

const STORAGE_KEY = 'i_doms_sales_orders'
/** v13：回款登记联动演示（合同→订单、订单→发货） */
const DATA_VERSION = 13
let orderSeq = 20
let deliverySeq = 113

function migrateSalesOrderStatuses(orders) {
  return (orders || []).map((order) => {
    const progressStatus = normalizeSalesOrderProgressStatus(order.progressStatus)
    let approvalRecords = Array.isArray(order.approvalRecords) ? order.approvalRecords : []
    if (isEcnDemoSalesOrder(order)) {
      const hasReject = approvalRecords.some((r) => r.result === '已驳回' || r.result === '已拒绝')
      const hasPass = approvalRecords.some((r) => r.result === '已通过')
      if (!hasReject || !hasPass) {
        approvalRecords = buildEcnDemoSalesOrderApprovalRecords()
      }
    }
    return {
      ...order,
      progressStatus,
      approvalRecords,
      updatedAt: order.updatedAt || order.createdAt || '',
      updater: order.updater || order.creator || '',
    }
  })
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (
        Array.isArray(parsed.orders) &&
        (parsed.version === DATA_VERSION ||
          parsed.version === 8 ||
          parsed.version === 9 ||
          parsed.version === 10 ||
          parsed.version === 11 ||
          parsed.version === 12)
      ) {
        return migrateSalesOrderStatuses(parsed.orders)
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

function persist() {
  persistJson(STORAGE_KEY, { version: DATA_VERSION, orders: salesOrderState.orders })
}

function isMockSalesOrder(order) {
  const id = String(order?.id || '')
  if (/^(so-1|so-2|so-3)$/.test(id)) return true
  return /seed|demo|pay-link|dedicated-ship|scatter-ebom|ship-acc|tf-dual|biz-seed/i.test(id)
}

function loadInitialSalesOrders() {
  ensureEcnDemoBootstrap()
  const stored = loadFromStorage() || []
  const orders = stored.filter((order) => !isMockSalesOrder(order))
  return hydrateApprovedSelfProdOrders(migrateSalesOrderStatuses(orders))
}

function touchOrder(order) {
  order.updatedAt = dayjs().format('YYYY-MM-DD HH:mm')
  order.updater = order.updater || 'admin1'
}

function pushApprovalRecord(order, { result, opinion }) {
  if (!Array.isArray(order.approvalRecords)) order.approvalRecords = []
  order.approvalRecords.unshift({
    name: 'admin1',
    role: '销售审核',
    result,
    time: dayjs().format('YYYY-MM-DD HH:mm'),
    opinion: String(opinion || '').trim(),
  })
}

export function generateSalesOrderNo() {
  orderSeq += 1
  return `XSDD${dayjs().format('YYYYMM')}${String(orderSeq).padStart(4, '0')}`
}

export function generateDeliveryCode() {
  deliverySeq += 1
  return `SH${dayjs().format('YYYYMMDD')}${String(deliverySeq).padStart(3, '0')}`
}

export const salesOrderState = reactive({
  orders: loadInitialSalesOrders(),
})

watch(
  () => salesOrderState.orders,
  () => persist(),
  { deep: true },
)

export function addSalesOrder(order) {
  salesOrderState.orders.unshift(order)
}

export function updateSalesOrder(id, patch) {
  const idx = salesOrderState.orders.findIndex((o) => o.id === id)
  if (idx === -1) return null
  Object.assign(salesOrderState.orders[idx], patch)
  recalcOrderAmounts(salesOrderState.orders[idx])
  return salesOrderState.orders[idx]
}

export function deleteSalesOrder(id) {
  const idx = salesOrderState.orders.findIndex((o) => o.id === id)
  if (idx === -1) return false
  salesOrderState.orders.splice(idx, 1)
  return true
}

export function getSalesOrderById(id) {
  return salesOrderState.orders.find((o) => o.id === id) || null
}

export function findSalesOrderByOrderNo(orderNo) {
  if (!orderNo) return null
  return salesOrderState.orders.find((o) => o.orderNo === orderNo) || null
}

/** 记录一次发货申请 */
export function addDeliveryApplication(orderId, application) {
  const order = salesOrderState.orders.find((o) => o.id === orderId)
  if (!order) return null
  if (!Array.isArray(order.deliveryApplications)) {
    order.deliveryApplications = []
  }
  const row = {
    id: `da-${Date.now()}`,
    createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
    status: '已提交',
    ...application,
  }
  order.deliveryApplications.unshift(row)
  const issued = Number(application.totalShipQty) || 0
  if (issued > 0) {
    order.totalIssuedQty = (Number(order.totalIssuedQty) || 0) + issued
    if (order.deliveryStatus === '未发货') order.deliveryStatus = '部分发货'
  }
  queueMicrotask(() => {
    import('@/store/deliveryOrderStore').then(({ registerDeliveryFromApplication }) => {
      registerDeliveryFromApplication(orderId, row)
    })
  })
  return row
}

export function findDeliveryApplicationById(orderId, applicationId) {
  const order = salesOrderState.orders.find((o) => o.id === orderId)
  if (!order || !applicationId) return null
  return (order.deliveryApplications || []).find((a) => a.id === applicationId) || null
}

/** 更新销售订单上的发货申请（发货单回写数量/状态） */
export function updateDeliveryApplication(orderId, applicationId, patch = {}) {
  const order = salesOrderState.orders.find((o) => o.id === orderId)
  if (!order || !applicationId) return null
  if (!Array.isArray(order.deliveryApplications)) order.deliveryApplications = []
  const idx = order.deliveryApplications.findIndex((a) => a.id === applicationId)
  if (idx === -1) return null
  const prev = order.deliveryApplications[idx]
  const next = { ...prev, ...patch, id: applicationId }
  order.deliveryApplications[idx] = next
  touchOrder(order)
  return next
}

export function recalcOrderAmounts(order) {
  applyOrderAmounts(order, { taxModeExcluding: true })
}

export function canEditSalesOrder(order) {
  const status = normalizeSalesOrderProgressStatus(order?.progressStatus)
  return status === SALES_ORDER_STATUS.DRAFT || status === SALES_ORDER_STATUS.REJECTED
}

export function canSubmitSalesOrder(order) {
  return normalizeSalesOrderProgressStatus(order?.progressStatus) === SALES_ORDER_STATUS.DRAFT
}

export function canWithdrawSalesOrder(order) {
  return normalizeSalesOrderProgressStatus(order?.progressStatus) === SALES_ORDER_STATUS.PENDING
}

export function canResubmitSalesOrder(order) {
  return normalizeSalesOrderProgressStatus(order?.progressStatus) === SALES_ORDER_STATUS.REJECTED
}

export function canApproveSalesOrder(order) {
  return normalizeSalesOrderProgressStatus(order?.progressStatus) === SALES_ORDER_STATUS.PENDING
}

export function canRevokeSalesOrderApproval(order) {
  return normalizeSalesOrderProgressStatus(order?.progressStatus) === SALES_ORDER_STATUS.IN_PROGRESS
}

export function canChangeDeliveryMode(order) {
  if (normalizeSalesOrderProgressStatus(order?.progressStatus) !== SALES_ORDER_STATUS.IN_PROGRESS) {
    return false
  }
  return (order.lineItems || []).some((line) =>
    isSelfMadeBusinessType(resolveLineBusinessType(line, order)),
  )
}

/** 变更销售明细交付方式，并同步生产计划 */
export function changeSalesOrderDeliveryMode(orderId, rows) {
  const order = salesOrderState.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, message: '销售订单不存在' }
  if (!canChangeDeliveryMode(order)) {
    return { ok: false, message: '仅已审核的自产销售订单可变更交付方式' }
  }

  const check = validateChangeDeliveryRows(order, rows)
  if (!check.ok) return check

  const planOps = applyDeliveryModeChanges(order, rows)
  syncProductionPlanDeliveryMode(order.orderNo, planOps)
  recalcOrderAmounts(order)

  return { ok: true, message: '交付方式变更成功' }
}

/** 待提交 → 待审核 */
export function submitSalesOrderForApprove(id) {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canSubmitSalesOrder(order)) {
    return { ok: false, message: '仅「待提交」状态可提交审核' }
  }
  if (!order.lineItems?.length) {
    return { ok: false, message: `订单「${order.orderNo}」请先添加销售明细后再提交` }
  }
  order.progressStatus = SALES_ORDER_STATUS.PENDING
  touchOrder(order)
  return { ok: true, message: `订单「${order.orderNo}」已提交审核` }
}

/** 待审核 → 待提交 */
export function withdrawSalesOrder(id) {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canWithdrawSalesOrder(order)) {
    return { ok: false, message: '仅「待审核」状态可撤回' }
  }
  order.progressStatus = SALES_ORDER_STATUS.DRAFT
  touchOrder(order)
  return { ok: true, message: `订单「${order.orderNo}」已撤回` }
}

/** 已拒绝 → 待审核 */
export function resubmitSalesOrder(id) {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canResubmitSalesOrder(order)) {
    return { ok: false, message: '仅「已拒绝」状态可重新提交' }
  }
  order.progressStatus = SALES_ORDER_STATUS.PENDING
  touchOrder(order)
  return { ok: true, message: `订单「${order.orderNo}」已重新提交审核` }
}

/**
 * 审核销售订单；外购销售审核通过时自动生成采购申请
 * @returns {{ ok: boolean, message: string, purchaseReqNo?: string }}
 */
export function approveSalesOrder(id, opinion = '') {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canApproveSalesOrder(order)) {
    return { ok: false, message: `订单「${order.orderNo}」不可审核` }
  }
  if (!order.lineItems?.length) {
    return { ok: false, message: `订单「${order.orderNo}」请先添加销售明细后再审核` }
  }

  order.lineItems = (order.lineItems || []).map((line) => normalizeSalesLineBusiness(line, order))

  const skuGuard = validateSalesLinesSkuResolved(order.lineItems)
  if (!skuGuard.ok) {
    return { ok: false, message: `订单「${order.orderNo}」${skuGuard.message}` }
  }

  const selfMadeLines = order.lineItems.filter((line) =>
    isSelfMadeBusinessType(resolveLineBusinessType(line, order)),
  )
  const purchaseLines = order.lineItems.filter((line) =>
    isPurchasedBusinessType(resolveLineBusinessType(line, order)),
  )
  const outsourcingLines = order.lineItems.filter((line) =>
    isOutsourcingBusinessType(resolveLineBusinessType(line, order)),
  )
  const maintenanceLines = order.lineItems.filter((line) =>
    isMaintenanceServiceBusinessType(resolveLineBusinessType(line, order)),
  )

  let purchaseReqNo
  let planOrderNo
  let outsourceWorkOrderCodes = []
  let maintenanceWorkOrderCodes = []
  let designTaskCount = 0
  const stockHints = []

  if (selfMadeLines.length) {
    const standardLines = []
    const customLines = []
    const designTasksByLineId = new Map()

    for (const line of selfMadeLines) {
      const lineBusinessType = resolveLineBusinessType(line, order)
      if (!line.productId && !isCustomSalesBusinessType(lineBusinessType)) {
        return {
          ok: false,
          message: `订单「${order.orderNo}」明细「${line.productName || '未命名'}」未关联产品，请重新选择产品`,
        }
      }
      if (isCustomSalesBusinessType(lineBusinessType) && !line.productName?.trim()) {
        return {
          ok: false,
          message: `订单「${order.orderNo}」定制销售明细请填写产品名称`,
        }
      }

      line.bomFulfillmentPath = normalizeBomFulfillmentPath(line.bomFulfillmentPath)
      if (!line.bomFulfillmentPath) {
        const ownBom = line.productId ? getOwnActiveBomForItem('product', line.productId) : null
        if (isCustomSalesBusinessType(lineBusinessType) || !ownBom) {
          line.bomFulfillmentPath = BOM_FULFILLMENT_PATH.DESIGN_REQUIRED
        } else {
          line.bomFulfillmentPath = BOM_FULFILLMENT_PATH.USE_CATALOG_BOM
        }
      }

      const pathCheck = validateFulfillmentPathForApprove(line, order)
      if (!pathCheck.ok) {
        return { ok: false, message: `订单「${order.orderNo}」${pathCheck.message}` }
      }

      if (line.bomFulfillmentPath === BOM_FULFILLMENT_PATH.DESIGN_REQUIRED) {
        const product = line.productId
          ? productInfoState.products.find((p) => p.id === line.productId)
          : null
        if (
          isCustomSalesBusinessType(lineBusinessType) ||
          isCustomProductAttribute(product?.productAttribute)
        ) {
          line.productAttr = line.productAttr || '定制产品'
        }
        line.bomId = ''
        line.bomName = ''
        line.bomVersion = ''
        customLines.push(line)
        continue
      }
      standardLines.push(line)
    }

    for (const line of standardLines) {
      const bom = getOwnActiveBomForItem('product', line.productId)
      if (!bom) {
        return {
          ok: false,
          message: `产品「${line.productName}」无自有生效 BOM，请改选「需设计任务」或先为该 SKU 维护并启用产品 BOM`,
        }
      }
      line.bomId = bom.id
      line.bomName = bom.bomName
      line.bomVersion = bom.version
      line.deliveryMode = normalizeDeliveryMode(line, order)
      line.stockFulfillmentMode = normalizeStockFulfillmentMode(line.stockFulfillmentMode)
      const salesQty = Number(line.salesQty ?? line.qty) || 1
      line.ebomSnapshot = buildEbomSnapshotFromBom(bom, salesQty)
      if (!line.lineAccessoryKits?.length) {
        line.lineAccessoryKits = buildLineAccessoryKits(line)
      }
    }

    for (const line of customLines) {
      line.deliveryMode = normalizeDeliveryMode(line, order)
      line.stockFulfillmentMode = normalizeStockFulfillmentMode(line.stockFulfillmentMode)
      const task = createDesignTaskFromSalesLine(order, line)
      designTasksByLineId.set(line.id, task)
      designTaskCount += 1
    }

    const fulfillmentRows = buildLineStockFulfillmentPlan(standardLines, {
      forceFullPlanLineIds: new Set(),
      getAllocatedQty: (line) => getLineAllocatedQty(order.id, line.id),
    })
    // 仅现货库存不足仍允许审核：按现有自由备货占用，缺口记库存状态，不拦截、不排产
    const stockOnlyShortfalls = listStockOnlyShortfalls(fulfillmentRows)
    if (stockOnlyShortfalls.length) {
      stockHints.push(
        `「仅现货」自由备货不足仍已通过：${stockOnlyShortfalls
          .map((r) => `「${r.productName || r.productCode}」缺 ${r.shortfall}`)
          .join('；')}`,
      )
    }

    const fulfillByLineId = new Map(fulfillmentRows.map((r) => [r.lineId, r]))
    for (const line of standardLines) {
      const row = fulfillByLineId.get(line.id)
      line.stockTakeQty = row?.stockTake ?? 0
      line.planProduceQty = row?.planQty ?? 0
    }
    for (const line of customLines) {
      const need = Number(line.salesQty ?? line.qty) || 0
      line.stockTakeQty = 0
      line.planProduceQty = need
    }

    const planLines = [
      ...standardLines.filter((l) => (Number(l.planProduceQty) || 0) > 0),
      ...customLines,
    ]
    if (planLines.length) {
      if (!order.orderAccessoryKits?.length && standardLines.length) {
        order.orderAccessoryKits = buildOrderAccessoryKits(order)
      }
      const plan = createProductionPlanFromSalesOrder(
        { ...order, lineItems: planLines },
        {
          lineItemsOverride: planLines,
          designingLineIds: new Set(customLines.map((l) => l.id)),
          designTasksByLineId,
        },
      )
      planOrderNo = plan.orderNo
      const coveredOnly = standardLines.filter(
        (l) => (Number(l.planProduceQty) || 0) <= 0 && (Number(l.stockTakeQty) || 0) > 0,
      )
      if (coveredOnly.length) {
        stockHints.push(
          `${coveredOnly.length} 行已由自由备货覆盖，未生成生产计划行（${coveredOnly
            .map((l) => l.productName || l.productCode)
            .join('、')}）`,
        )
      }
    } else if (standardLines.length) {
      stockHints.push('自产明细均由自由备货覆盖，未生成生产计划')
    }
  }

  // 随货配件库存 enrichment，供外购合并与后续履约使用（仅「销售订单时确定」）
  // eslint-disable-next-line global-require
  const {
    enrichShipAccessoryList,
    buildShipAccessoryPurchaseLineItems,
    mergePurchaseLineItems,
    fulfillShipAccessoryGapsBySupply,
    getShipAccessoryPurchaseGapRows,
    markAccessoryBucketConverted,
  } = require('@/utils/salesOrderShipAccessories')
  // eslint-disable-next-line global-require
  const { isShipAttachmentDecidedAtOrder } = require('@/store/functionParamStore')
  const warehouse = order.defaultWarehouse || ''
  const shipAccessoryEnabled = isShipAttachmentDecidedAtOrder()
  if (
    shipAccessoryEnabled &&
    Array.isArray(order.shipAccessories) &&
    order.shipAccessories.length
  ) {
    order.shipAccessories = enrichShipAccessoryList(order.shipAccessories, warehouse)
  }
  const accessoryPurchaseGaps = shipAccessoryEnabled
    ? getShipAccessoryPurchaseGapRows(order, warehouse)
    : []

  if (purchaseLines.length || accessoryPurchaseGaps.length) {
    if (order.purchaseRequisitionNo) {
      return { ok: false, message: `订单「${order.orderNo}」已关联采购申请` }
    }
    // 运行时再取，避免 salesOrderStore ↔ purchaseRequisitionStore 循环依赖
    // eslint-disable-next-line global-require
    const {
      buildRequisitionFromSalesOrder,
      addPurchaseRequisition,
    } = require('@/store/purchaseRequisitionStore')
    let requisition
    if (purchaseLines.length) {
      requisition = buildRequisitionFromSalesOrder({ ...order, lineItems: purchaseLines })
    } else {
      requisition = buildRequisitionFromSalesOrder({ ...order, lineItems: [] })
      requisition.source = '销售订单随货配件'
      requisition.remark = `由销售订单 ${order.orderNo || ''} 随货配件缺口生成`
      requisition.lineItems = []
    }
    if (accessoryPurchaseGaps.length) {
      const accLines = buildShipAccessoryPurchaseLineItems(order, accessoryPurchaseGaps, {
        warehouse,
      })
      requisition.lineItems = mergePurchaseLineItems(requisition.lineItems || [], accLines)
      const tip = `含随货配件外购缺口 ${accLines.length} 项`
      if (!String(requisition.remark || '').includes('随货配件')) {
        requisition.remark = requisition.remark ? `${requisition.remark}；${tip}` : tip
      }
      if (purchaseLines.length) {
        requisition.source = '销售订单'
      }
      markAccessoryBucketConverted(accessoryPurchaseGaps, 'purchase')
    }
    if (!(requisition.lineItems || []).length) {
      return {
        ok: false,
        message: `订单「${order.orderNo}」外购明细与配件缺口均为空，无法生成采购申请`,
      }
    }
    addPurchaseRequisition(requisition)
    order.purchaseRequisitionNo = requisition.reqNo
    order.purchaseRequisitionId = requisition.id
    purchaseReqNo = requisition.reqNo
  }

  // 审核通过时：随货配件自制/组装→生产计划，外协→外协订单；外购已合并进上方采购申请
  let shipAccessoryFulfillHint = ''
  if (
    shipAccessoryEnabled &&
    Array.isArray(order.shipAccessories) &&
    order.shipAccessories.length
  ) {
    const accRes = fulfillShipAccessoryGapsBySupply(order, order.shipAccessories, {
      warehouse,
      skipPurchase: true,
    })
    if (accRes.ok) {
      shipAccessoryFulfillHint = accRes.message
    }
  }

  if (outsourcingLines.length) {
    for (const line of outsourcingLines) {
      if (!line.productName?.trim()) {
        return {
          ok: false,
          message: `订单「${order.orderNo}」外协明细请填写产品名称`,
        }
      }
    }
    const created = createOutsourcingWorkOrdersFromSalesOrder(order, outsourcingLines)
    outsourceWorkOrderCodes = created.map((wo) => wo.code)
  }

  if (maintenanceLines.length) {
    for (const line of maintenanceLines) {
      if (!line.productName?.trim()) {
        return {
          ok: false,
          message: `订单「${order.orderNo}」维修服务明细请填写产品名称`,
        }
      }
    }
    const created = createMaintenanceWorkOrdersFromSalesOrder(order, maintenanceLines)
    maintenanceWorkOrderCodes = created.map((wo) => wo.code)
  }

  order.businessType = deriveOrderBusinessType(order.lineItems, order.businessType)
  order.progressStatus = SALES_ORDER_STATUS.IN_PROGRESS
  order.approver = order.approver || 'admin1'
  order.approvedAt = dayjs().format('YYYY-MM-DD HH:mm')

  // 未挂合同台账：按订单回款节点预设生成回款计划（运行时再取，避免循环依赖）
  let orderPaymentPlanHint = ''
  try {
    // eslint-disable-next-line global-require
    const { ensurePaymentPlansForSalesOrder } = require('@/store/salesPaymentStore')
    const payRes = ensurePaymentPlansForSalesOrder(order, { rebuild: false })
    if (payRes.ok && payRes.created) {
      orderPaymentPlanHint = `已生成订单回款计划 ${payRes.data?.length || 0} 个节点`
    }
  } catch {
    /* ignore */
  }

  const allocatableLines = [...selfMadeLines, ...purchaseLines].filter((l) => l.productCode)
  const selfTake = {}
  for (const line of selfMadeLines) {
    if (line.productCode) selfTake[line.id] = Number(line.stockTakeQty) || 0
  }
  allocateStockOnSalesApprove(
    order,
    selfMadeLines.filter((l) => l.productCode),
    { takeByLineId: selfTake },
  )
  allocateStockOnSalesApprove(
    order,
    purchaseLines.filter((l) => l.productCode),
  )
  order.inventoryStatus = buildOrderInventoryStatus(order)

  for (const line of allocatableLines) {
    const remind = buildLineStockReminder(line, order)
    const modeLabel = stockFulfillmentModeLabel(line.stockFulfillmentMode)
    if (remind.otherQty > 0) {
      stockHints.push(`「${line.productName}」他单占用 ${remind.otherQty}`)
    }
    if ((Number(line.planProduceQty) || 0) <= 0 && (Number(line.stockTakeQty) || 0) > 0) {
      stockHints.push(
        `「${line.productName}」履约「${modeLabel}」：占用现货 ${line.stockTakeQty}，无需排产`,
      )
    } else if ((Number(line.planProduceQty) || 0) > 0 && (Number(line.stockTakeQty) || 0) > 0) {
      stockHints.push(
        `「${line.productName}」履约「${modeLabel}」：占用现货 ${line.stockTakeQty}，排产 ${line.planProduceQty}`,
      )
    } else if (remind.status !== '充足') {
      stockHints.push(
        `「${line.productName}」库存${remind.status}：现有 ${remind.onHand}，自由备货 ${remind.freeQty}，需求 ${remind.need}`,
      )
    }
  }

  touchOrder(order)
  pushApprovalRecord(order, { result: '已通过', opinion })

  let industrialLabelHint = ''
  try {
    const labelRes = createLabelRequestFromSalesOrder(order)
    applyLabelSummaryToSalesLines(order, labelRes.lineResults || [])
    if (labelRes.request?.orderNo) {
      ;(order.lineItems || []).forEach((line) => {
        if (line.needIndustrialLabel && salesLineIndustrialLabelNeedQty(line) > 0) {
          line.industrialLabelRequestNo = labelRes.request.orderNo
        }
      })
    }
    if (labelRes.request) {
      industrialLabelHint = labelRes.ok
        ? `工业标识申请 ${labelRes.request.orderNo}（成功 ${labelRes.request.successCount}）`
        : `工业标识申请未全部成功（可在详情重试/补申请）`
    }
  } catch (e) {
    industrialLabelHint = '工业标识申请异常，订单已审核通过，可在详情重试'
  }

  const hints = []
  if (purchaseReqNo) {
    hints.push(
      accessoryPurchaseGaps.length && purchaseLines.length
        ? `已自动生成采购申请 ${purchaseReqNo}（含随货配件外购缺口）`
        : accessoryPurchaseGaps.length
          ? `已自动生成采购申请 ${purchaseReqNo}（随货配件外购缺口）`
          : `已自动生成采购申请 ${purchaseReqNo}`,
    )
  }
  if (shipAccessoryFulfillHint) hints.push(shipAccessoryFulfillHint)
  if (planOrderNo) {
    let planHint = `已自动生成生产计划 ${planOrderNo}`
    if (designTaskCount > 0) {
      planHint += `，已生成 ${designTaskCount} 条设计任务（明细状态：设计中）`
    }
    hints.push(planHint)
  }
  if (stockHints.length) hints.push(...stockHints)
  if (outsourceWorkOrderCodes.length) {
    hints.push(`外协工单 ${outsourceWorkOrderCodes.join('、')}`)
  }
  if (maintenanceWorkOrderCodes.length) {
    hints.push(`维修工单 ${maintenanceWorkOrderCodes.join('、')}`)
  }
  if (industrialLabelHint) hints.push(industrialLabelHint)
  if (orderPaymentPlanHint) hints.push(orderPaymentPlanHint)

  const message = hints.length
    ? `订单「${order.orderNo}」审核通过，${hints.join('；')}`
    : `订单「${order.orderNo}」审核通过`

  return {
    ok: true,
    message,
    purchaseReqNo,
    planOrderNo,
    designTaskCount,
    stockHints,
    outsourceWorkOrderCodes,
    maintenanceWorkOrderCodes,
  }
}

/** 审核拒绝 → 已拒绝 */
export function rejectSalesOrder(id, opinion = '') {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canApproveSalesOrder(order)) {
    return { ok: false, message: `订单「${order.orderNo}」不可审核` }
  }
  order.progressStatus = SALES_ORDER_STATUS.REJECTED
  order.approver = 'admin1'
  order.approvedAt = dayjs().format('YYYY-MM-DD HH:mm')
  touchOrder(order)
  pushApprovalRecord(order, { result: '已驳回', opinion })
  return { ok: true, message: `订单「${order.orderNo}」已拒绝` }
}

/**
 * 反审销售订单；未下达工单/采购申请/外协订单才可反审
 * @returns {{ ok: boolean, message: string, blocked?: boolean }}
 */
export function revokeSalesOrderApproval(id) {
  const order = salesOrderState.orders.find((o) => o.id === id)
  if (!order) return { ok: false, message: '订单不存在' }
  if (!canRevokeSalesOrderApproval(order)) {
    return { ok: false, message: `订单「${order.orderNo}」当前状态不可反审` }
  }

  if (hasSalesOrderRevokeBlockers(order)) {
    return {
      ok: false,
      blocked: true,
      message: SALES_ORDER_REVOKE_BLOCKED_MESSAGE,
    }
  }

  if (salesOrderHasBoundLabels(order.orderNo)) {
    return {
      ok: false,
      blocked: true,
      message: '存在已装牌或已出库的工业标识，禁止反审',
    }
  }

  const voidRes = voidLabelsBySalesOrder(order.orderNo)
  if (!voidRes.ok) {
    return {
      ok: false,
      blocked: Boolean(voidRes.blocked),
      message: voidRes.message || '工业标识作废失败，无法反审',
    }
  }

  ;(order.lineItems || []).forEach((line) => {
    line.industrialLabelStatus = '—'
    line.industrialLabelSuccessCount = 0
    line.industrialLabelFailCount = 0
    line.industrialLabelRequestNo = ''
  })

  order.progressStatus = SALES_ORDER_STATUS.PENDING
  order.approver = ''
  order.approvedAt = ''
  releaseOrderAllocations(order.id)
  order.inventoryStatus = buildOrderInventoryStatus(order)
  touchOrder(order)
  pushApprovalRecord(order, { result: '已反审', opinion: '' })

  const voidHint = voidRes.voidedCount ? `，已作废工业标识 ${voidRes.voidedCount} 个` : ''
  return {
    ok: true,
    message: `订单「${order.orderNo}」已反审，状态已变更为待审核${voidHint}`,
  }
}

export { isSalesOrderApproved, SALES_ORDER_STATUS }
