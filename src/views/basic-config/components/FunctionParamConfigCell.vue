<template>
  <div class="param-config-cell">
    <a-radio-group
      v-if="record.key === 'salaryPushMode'"
      :value="salaryPushMode"
      @change="(e) => onSalaryPushChange(e.target.value)"
    >
      <a-radio v-for="option in SALARY_PUSH_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-checkbox-group
      v-else-if="record.key === 'autoApproveDocs'"
      class="checkbox-wrap"
      :value="autoApproveDocKeys"
      @change="onAutoApproveDocsChange"
    >
      <a-checkbox v-for="option in AUTO_APPROVE_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-checkbox>
    </a-checkbox-group>

    <a-radio-group
      v-else-if="record.key === 'inventoryDeductMode'"
      :value="inventoryDeductMode"
      @change="(e) => onInventoryDeductChange(e.target.value)"
    >
      <a-radio v-for="option in INVENTORY_DEDUCT_OPTIONS" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'outboundIssueRule'"
      :value="outboundIssueRule"
      @change="(e) => onOutboundIssueRuleChange(e.target.value)"
    >
      <a-radio
        v-for="option in OUTBOUND_ISSUE_RULE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'workshopStagingMergeContentMode'"
      :value="workshopStagingMergeContentMode"
      @change="(e) => onWorkshopStagingMergeContentModeChange(e.target.value)"
    >
      <a-radio
        v-for="option in WORKSHOP_STAGING_MERGE_CONTENT_OPTIONS"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'processRouteMode'"
      :value="processRouteMode"
      @change="(e) => onProcessRouteModeChange(e.target.value)"
    >
      <a-radio
        v-for="option in PROCESS_ROUTE_MODE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'processFeedDeductMode'"
      :value="processFeedDeductMode"
      @change="(e) => onProcessFeedDeductModeChange(e.target.value)"
    >
      <a-radio
        v-for="option in PROCESS_FEED_DEDUCT_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'processFeedDeductModeRecycle'"
      :value="processFeedDeductModeRecycle"
      @change="(e) => onProcessFeedDeductModeRecycleChange(e.target.value)"
    >
      <a-radio
        v-for="option in PROCESS_FEED_DEDUCT_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-switch
      v-else-if="record.key === 'enableSalesOrderDiscount'"
      :checked="enableSalesOrderDiscount"
      checked-children="开"
      un-checked-children="关"
      @change="onEnableSalesOrderDiscountChange"
    />

    <a-switch
      v-else-if="record.key === 'enableSequentialBatchStep'"
      :checked="enableSequentialBatchStep"
      checked-children="开"
      un-checked-children="关"
      @change="onEnableSequentialBatchStepChange"
    />

    <a-radio-group
      v-else-if="record.key === 'salesOrderStockFulfillmentDefault'"
      :value="salesOrderStockFulfillmentDefault"
      @change="(e) => onSalesOrderStockFulfillmentDefaultChange(e.target.value)"
    >
      <a-radio
        v-for="option in SALES_ORDER_STOCK_FULFILLMENT_DEFAULT_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-radio-group
      v-else-if="record.key === 'paymentLinkMode'"
      :value="paymentLinkMode"
      @change="(e) => onPaymentLinkModeChange(e.target.value)"
    >
      <a-radio
        v-for="option in PAYMENT_LINK_MODE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-switch
      v-else-if="record.key === 'transferRequireInboundConfirm'"
      :checked="transferRequireInboundConfirm"
      checked-children="需要"
      un-checked-children="自动"
      @change="onTransferRequireInboundConfirmChange"
    />

    <a-switch
      v-else-if="record.key === 'stocktakeAutoPostOnApprove'"
      :checked="stocktakeAutoPostOnApprove"
      checked-children="自动"
      un-checked-children="手动"
      @change="onStocktakeAutoPostOnApproveChange"
    />

    <a-switch
      v-else-if="record.displayOnly && record.controlType === 'switch'"
      :checked="Boolean(displayParams[displaySwitchKey(record)])"
      checked-children="开"
      un-checked-children="关"
      @change="(checked) => onDisplaySwitchChange(record, checked)"
    />

    <a-radio-group
      v-else-if="record.displayOnly && record.controlType === 'radio'"
      :value="displayRadioValue(record)"
      @change="(e) => onDisplayRadioChange(record, e.target.value)"
    >
      <a-radio v-for="option in record.options || []" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-radio>
    </a-radio-group>

    <a-checkbox-group
      v-else-if="record.displayOnly && record.controlType === 'checkboxGroup'"
      class="checkbox-wrap"
      :value="displayCheckboxKeys(record)"
      @change="(keys) => onDisplayCheckboxChange(record, keys)"
    >
      <a-checkbox v-for="option in record.options || []" :key="option.value" :value="option.value">
        {{ option.label }}
      </a-checkbox>
    </a-checkbox-group>
  </div>
</template>

<script>
export default { name: 'FunctionParamConfigCell' }
</script>

<script setup>
import { computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  PAYMENT_LINK_MODE_OPTIONS,
  SALARY_PUSH_OPTIONS,
  AUTO_APPROVE_OPTIONS,
  INVENTORY_DEDUCT_OPTIONS,
  functionParamState,
  setSalaryPushMode,
  setAutoApproveDocs,
  setInventoryDeductMode,
  getInventoryDeductMode,
  OUTBOUND_ISSUE_RULE_OPTIONS,
  getOutboundIssueRule,
  setOutboundIssueRule,
  WORKSHOP_STAGING_MERGE_CONTENT_OPTIONS,
  getWorkshopStagingMergeContentMode,
  setWorkshopStagingMergeContentMode,
  PROCESS_ROUTE_MODE_OPTIONS,
  PROCESS_FEED_DEDUCT_OPTIONS,
  getProcessRouteMode,
  setProcessRouteMode,
  getProcessFeedDeductMode,
  setProcessFeedDeductMode,
  getProcessFeedDeductModeRecycle,
  setProcessFeedDeductModeRecycle,
  isSalesOrderDiscountEnabled,
  setEnableSalesOrderDiscount,
  isSequentialBatchStepEnabled,
  setEnableSequentialBatchStep,
  SALES_ORDER_STOCK_FULFILLMENT_DEFAULT_OPTIONS,
  getSalesOrderStockFulfillmentDefault,
  setSalesOrderStockFulfillmentDefault,
  getPaymentLinkMode,
  setPaymentLinkMode,
  isTransferRequireInboundConfirm,
  setTransferRequireInboundConfirm,
  isStocktakeAutoPostOnApprove,
  setStocktakeAutoPostOnApprove,
  getDisplayParams,
  setDisplayParam,
} from '@/store/functionParamStore'

defineProps({
  record: { type: Object, required: true },
})

const salaryPushMode = computed(() => functionParamState.params.salaryPushMode)
const inventoryDeductMode = computed(() => getInventoryDeductMode())
const outboundIssueRule = computed(() => {
  void functionParamState.params.outboundIssueRule
  return getOutboundIssueRule()
})
const workshopStagingMergeContentMode = computed(() => {
  void functionParamState.params.workshopStagingMergeContentMode
  return getWorkshopStagingMergeContentMode()
})
const processRouteMode = computed(() => {
  void functionParamState.params.processRouteMode
  return getProcessRouteMode()
})
const processFeedDeductMode = computed(() => {
  void functionParamState.params.processFeedDeductMode
  return getProcessFeedDeductMode()
})
const processFeedDeductModeRecycle = computed(() => {
  void functionParamState.params.processFeedDeductModeRecycle
  return getProcessFeedDeductModeRecycle()
})
const enableSalesOrderDiscount = computed(() => isSalesOrderDiscountEnabled())
const enableSequentialBatchStep = computed(() => {
  void functionParamState.params.enableSequentialBatchStep
  return isSequentialBatchStepEnabled()
})
const salesOrderStockFulfillmentDefault = computed(() => getSalesOrderStockFulfillmentDefault())
const paymentLinkMode = computed(() => getPaymentLinkMode())
const transferRequireInboundConfirm = computed(() => isTransferRequireInboundConfirm())
const stocktakeAutoPostOnApprove = computed(() => isStocktakeAutoPostOnApprove())

const displayParams = computed(() => {
  void functionParamState.params.displayParams
  return getDisplayParams()
})

const autoApproveDocKeys = computed(() =>
  AUTO_APPROVE_OPTIONS.filter(
    (option) => functionParamState.params.autoApproveDocs?.[option.value],
  ).map((option) => option.value),
)

function toastSave(res, successText = '已保存') {
  if (!res.ok) {
    message.warning(res.message || '保存失败')
    return
  }
  message.success(successText)
}

function onSalaryPushChange(mode) {
  toastSave(setSalaryPushMode(mode))
}
function onAutoApproveDocsChange(keys) {
  toastSave(setAutoApproveDocs(keys))
}
function onInventoryDeductChange(mode) {
  toastSave(setInventoryDeductMode(mode))
}
function onOutboundIssueRuleChange(mode) {
  toastSave(setOutboundIssueRule(mode), '已更新出库规则')
}
function onWorkshopStagingMergeContentModeChange(mode) {
  toastSave(setWorkshopStagingMergeContentMode(mode), '已更新车间暂存合并含量规则')
}
function onProcessRouteModeChange(value) {
  toastSave(setProcessRouteMode(value), '已更新工艺路线模式')
}
function onProcessFeedDeductModeChange(value) {
  toastSave(setProcessFeedDeductMode(value), '已更新新料投料扣减方式')
}
function onProcessFeedDeductModeRecycleChange(value) {
  toastSave(setProcessFeedDeductModeRecycle(value), '已更新回流投料扣减方式')
}
function onEnableSalesOrderDiscountChange(checked) {
  toastSave(
    setEnableSalesOrderDiscount(checked),
    checked ? '已开启销售订单价格折扣' : '已关闭销售订单价格折扣',
  )
}
function onEnableSequentialBatchStepChange(checked) {
  toastSave(
    setEnableSequentialBatchStep(checked),
    checked ? '已开启批次阶段时序确认' : '已关闭批次阶段时序确认',
  )
}
function onSalesOrderStockFulfillmentDefaultChange(mode) {
  toastSave(setSalesOrderStockFulfillmentDefault(mode), '已更新销售订单库存履约默认值')
}
function onPaymentLinkModeChange(mode) {
  toastSave(setPaymentLinkMode(mode))
}
function onTransferRequireInboundConfirmChange(checked) {
  toastSave(
    setTransferRequireInboundConfirm(checked),
    checked ? '已开启：调拨出库后需入库方签收' : '已关闭：调拨出库后自动入库完结',
  )
}
function onStocktakeAutoPostOnApproveChange(checked) {
  toastSave(
    setStocktakeAutoPostOnApprove(checked),
    checked ? '已开启：盘点审核通过后自动过账' : '已关闭：盘点审核通过后需手动过账',
  )
}

/** 展示项：开关类直接用 row.key 对应 displayParams */
function displaySwitchKey(record) {
  return record.key
}

/** 报工设置等：checkbox 值映射到独立 displayParams 字段 */
function displayCheckboxKeys(record) {
  if (record.key === 'reportSettings') {
    return displayParams.value.reportAllowOverReport ? ['allowOverReport'] : []
  }
  if (record.key === 'workOrderMaterialSettings') {
    const settings = displayParams.value.workOrderMaterialSettings || {}
    return (record.options || []).map((o) => o.value).filter((key) => Boolean(settings[key]))
  }
  return []
}

function onDisplaySwitchChange(record, checked) {
  toastSave(setDisplayParam(record.key, Boolean(checked)))
}

function displayRadioValue(record) {
  if (record.key === 'processFileSelectMode') {
    return displayParams.value.processFileSelectMode || 'item'
  }
  return displayParams.value[record.key]
}

function onDisplayRadioChange(record, value) {
  if (record.key === 'processFileSelectMode') {
    const mode = value === 'category' ? 'category' : 'item'
    toastSave(setDisplayParam('processFileSelectMode', mode))
    setDisplayParam('processFileSelectByCategory', mode === 'category')
    return
  }
  toastSave(setDisplayParam(record.key, value))
}

function onDisplayCheckboxChange(record, keys) {
  const list = Array.isArray(keys) ? keys : []
  if (record.key === 'reportSettings') {
    toastSave(setDisplayParam('reportAllowOverReport', list.includes('allowOverReport')))
    return
  }
  if (record.key === 'workOrderMaterialSettings') {
    const next = {}
    ;(record.options || []).forEach((opt) => {
      next[opt.value] = list.includes(opt.value)
    })
    toastSave(setDisplayParam('workOrderMaterialSettings', next))
    return
  }
  toastSave({ ok: false, message: '未知展示项' })
}
</script>

<style scoped>
.checkbox-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
</style>
