<template>
  <a-modal
    v-model:open="visible"
    title="编辑发货明细"
    width="960px"
    :mask-closable="false"
    destroy-on-close
    class="inventory-line-edit-modal"
    @cancel="handleCancel"
  >
    <a-form layout="vertical" class="edit-form">
      <a-form-item>
        <template #label>
          <span class="field-label">
            <FileTextOutlined />
            产品信息
          </span>
        </template>
        <a-input :value="lockedProductLabel" disabled />
        <div class="item-preview">
          <div class="preview-grid">
            <div class="preview-row">
              <span class="preview-label">产品编号</span>
              <span>{{ draft.productCode || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">产品名称</span>
              <span>{{ draft.productName || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">规格型号</span>
              <span>{{ draft.specModel || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">材质</span>
              <span>{{ draft.material || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">图号</span>
              <span>{{ draft.drawingNo || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">变体属性</span>
              <span>{{ draft.variantAttr || '—' }}</span>
            </div>
          </div>
          <div class="preview-bottom">
            <div class="preview-rest">
              <div class="preview-row">
                <span class="preview-label">订单数量</span>
                <span>{{ formatDeliveryQty(draft.orderQty) }} {{ draft.unit || '件' }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">库存数</span>
                <span>{{ formatDeliveryQty(draft.stockQty) }} {{ draft.unit || '件' }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">发货进度</span>
                <span>{{ progressDisplay }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">单价（不含税）</span>
                <span>{{ formatDeliveryPrice(draft.unitPriceExTax) }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">单价（含税）</span>
                <span>{{ formatDeliveryPrice(draft.unitPriceInTax) }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">发货总额（不含税）</span>
                <span>{{ formatDeliveryPrice(draft.deliveryAmountExTax) }}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">发货总额（含税）</span>
                <span>{{ formatDeliveryPrice(draft.deliveryAmountInTax) }}</span>
              </div>
            </div>
            <div class="preview-stock-box">
              <div class="stock-value">{{ formatDeliveryQty(draft.warehouseStockQty) }}</div>
              <div class="stock-label">当前仓库数量({{ draft.unit || '件' }})</div>
            </div>
          </div>
        </div>
      </a-form-item>

      <div v-if="contentPricing" class="settle-block">
        <div class="settle-title">含量结算</div>
        <div class="field-hint">
          {{ pricingRuleText }}。结算金额按各批过磅净重，不按本次发货数量。
        </div>
        <div v-for="(lot, index) in draft.settlementLots" :key="lot.key" class="lot-card">
          <a-form layout="inline" class="horizontal-form">
            <a-row :gutter="12" style="width: 100%">
              <a-col :span="8">
                <a-form-item label="批次">
                  <a-select
                    v-model:value="lot.batchId"
                    size="small"
                    allow-clear
                    placeholder="可手填含量"
                    :options="batchOptions"
                    @change="(id) => onLotBatchChange(lot, id)"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="实测含量(%)" required>
                  <a-input-number
                    v-model:value="lot.content"
                    size="small"
                    :min="0"
                    :max="100"
                    :precision="4"
                    placeholder="如 98.6"
                    style="width: 100%"
                    @change="recalcPreview"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="过磅净重" required>
                  <a-input-number
                    v-model:value="lot.weighQty"
                    size="small"
                    :min="0"
                    :precision="4"
                    style="width: 100%"
                    @change="recalcPreview"
                  />
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
          <div class="lot-foot">
            <span
              >结算单价（不含税）{{
                formatDeliveryPrice(settledPreview.rows[index]?.unitPriceExTax)
              }}</span
            >
            <span>金额 {{ formatDeliveryPrice(settledPreview.rows[index]?.amountExTax) }}</span>
            <a-button type="link" size="small" danger @click="removeLot(index)">删除</a-button>
          </div>
        </div>
        <a-button type="link" size="small" @click="addLot">添加批次</a-button>
        <div class="settle-sum">
          过磅合计 {{ formatDeliveryQty(settledPreview.weighSum) }}，结算不含税
          {{ formatDeliveryPrice(settledPreview.amountEx) }}，含税
          {{ formatDeliveryPrice(settledPreview.amountIn) }}
          <span v-if="bagHint">，{{ bagHint }}</span>
        </div>
      </div>
      <div v-else class="field-hint settle-flat">按档次一口价，发货沿用订单单价。</div>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <HomeOutlined />
                出库仓库
              </span>
            </template>
            <a-select
              v-model:value="draft.shipWarehouse"
              allow-clear
              placeholder="请选择出库仓库"
              :options="warehouseOpts"
              @change="refreshPreviewStock"
            />
          </a-form-item>
        </a-col>
        <a-col v-if="showShipQty" :span="8">
          <a-form-item required>
            <template #label>
              <span class="field-label">
                <UnorderedListOutlined />
                本次发货数量
              </span>
            </template>
            <a-input-number
              v-model:value="draft.shipQty"
              :min="0"
              :precision="4"
              :formatter="deliveryDecimalFormatter"
              :parser="deliveryDecimalParser"
              style="width: 100%"
              @change="recalcPreview"
            />
          </a-form-item>
        </a-col>
        <a-col v-if="!contentPricing" :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <UnorderedListOutlined />
                发货重量
              </span>
            </template>
            <a-input-number
              v-model:value="draft.shipWeight"
              :min="0"
              :precision="4"
              :formatter="deliveryDecimalFormatter"
              :parser="deliveryDecimalParser"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <FileTextOutlined />
                备注
              </span>
            </template>
            <a-textarea v-model:value="draft.lineRemark" :rows="2" placeholder="请输入备注" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleSave">确定</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { message } from 'ant-design-vue'
import { FileTextOutlined, HomeOutlined, UnorderedListOutlined } from '@ant-design/icons-vue'
import {
  formatDeliveryQty,
  formatDeliveryPrice,
  formatShipProgress,
  recalcDeliveryLine,
  deliveryDecimalFormatter,
  deliveryDecimalParser,
  roundDeliveryDecimal,
  refreshDeliveryLineStock,
  resolveDeliveryVariantAttr,
} from '@/utils/deliveryLine'
import { getWarehouseSelectOptions, warehouseState } from '@/store/warehouseStore'
import { getMaterialBatch, listMaterialBatches } from '@/store/materialBatchStore'
import {
  bagCountFromTons,
  contentSettlementReady,
  emptySettlementLot,
  formatPricingRule,
  isContentPricing,
  settleContentLots,
  toContentPercent,
} from '@/utils/salesContentPricing'

const props = defineProps({
  open: { type: Boolean, default: false },
  line: { type: Object, default: null },
  showShipQty: { type: Boolean, default: true },
})

const emit = defineEmits(['update:open', 'saved'])

const visible = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val),
})

const draft = reactive(createDraft())

const warehouseOpts = computed(() => {
  void warehouseState.warehouses
  return getWarehouseSelectOptions()
})

const lockedProductLabel = computed(() => {
  if (draft.productCode && draft.productName) return `[${draft.productCode}] ${draft.productName}`
  return draft.productName || draft.productCode || ''
})

const progressDisplay = computed(() =>
  formatShipProgress(
    draft.confirmedOutboundQty ?? draft.shippedQty,
    draft.appliedShipQty ?? draft.shippedQty,
    draft.orderQty,
  ),
)

const maxShipQty = computed(() => {
  const orderQty = Number(draft.orderQty) || 0
  const applied = Number(draft.appliedShipQty ?? draft.shippedQty ?? 0)
  return Math.max(0, orderQty - applied)
})

const contentPricing = computed(() => isContentPricing(draft))
const pricingRuleText = computed(() => formatPricingRule(draft))
const settledPreview = computed(() => settleContentLots(draft))
const bagHint = computed(() => {
  const bags = bagCountFromTons(settledPreview.value.weighSum, draft.unit)
  return bags == null ? '' : `按 800 公斤/袋折合 ${formatDeliveryQty(bags)} 袋`
})
const batchOptions = computed(() =>
  listMaterialBatches()
    .filter(
      (batch) =>
        batch.status === 'released' &&
        Number(batch.qty) > 0 &&
        (!draft.productId || batch.itemId === draft.productId),
    )
    .map((batch) => ({
      value: batch.id,
      label: `${batch.batchNo} · 余 ${batch.qty}${batch.content != null ? ` · ${toContentPercent(batch.content)}%` : ''}`,
    })),
)

watch(
  () => props.open,
  (open) => {
    if (!open || !props.line) return
    Object.assign(draft, createDraft(props.line))
    if (isContentPricing(draft) && !draft.settlementLots.length) addLot()
  },
)

function createDraft(line = {}) {
  const draftLine = {
    productName: line.productName || '',
    productCode: line.productCode || '',
    productId: line.productId || '',
    spuId: line.spuId || '',
    variantValues: line.variantValues || {},
    variantSummary: line.variantSummary || '',
    specAttr: line.specAttr || '',
    specModel: line.specModel || '',
    material: line.material || '',
    drawingNo: line.drawingNo || '',
    orderQty: roundDeliveryDecimal(line.orderQty ?? 0, 4),
    unitPriceExTax: roundDeliveryDecimal(line.unitPriceExTax ?? 0, 4),
    unitPriceInTax: roundDeliveryDecimal(line.unitPriceInTax ?? 0, 4),
    unit: line.unit || '',
    shippedQty: roundDeliveryDecimal(line.shippedQty ?? 0, 4),
    confirmedOutboundQty: roundDeliveryDecimal(
      line.confirmedOutboundQty ?? line.shippedQty ?? 0,
      4,
    ),
    appliedShipQty: roundDeliveryDecimal(line.appliedShipQty ?? line.shippedQty ?? 0, 4),
    shipQty: roundDeliveryDecimal(line.shipQty ?? 0, 4),
    shipWeight: roundDeliveryDecimal(line.shipWeight ?? 0, 4),
    pricingMode: line.pricingMode || 'flat',
    baseContent: line.baseContent ?? null,
    contentStep: line.contentStep ?? null,
    priceStepUp: line.priceStepUp ?? null,
    priceStepDown: line.priceStepDown ?? null,
    taxRate: line.taxRate ?? 0,
    baseUnitPriceExTax: roundDeliveryDecimal(
      line.baseUnitPriceExTax ?? line.unitPriceExTax ?? 0,
      4,
    ),
    baseUnitPriceInTax: roundDeliveryDecimal(
      line.baseUnitPriceInTax ?? line.unitPriceInTax ?? 0,
      4,
    ),
    settlementLots: Array.isArray(line.settlementLots)
      ? line.settlementLots.map((lot) => ({ ...lot }))
      : [],
    settlementText: line.settlementText || '',
    deliveryUnitPriceExTax: roundDeliveryDecimal(line.deliveryUnitPriceExTax ?? 0, 4),
    deliveryAmountExTax: roundDeliveryDecimal(line.deliveryAmountExTax ?? 0, 4),
    deliveryUnitPriceInTax: roundDeliveryDecimal(
      line.deliveryUnitPriceInTax ?? line.unitPriceInTax ?? 0,
      4,
    ),
    deliveryAmountInTax: roundDeliveryDecimal(line.deliveryAmountInTax ?? 0, 4),
    packagingForm: line.packagingForm || '',
    lineRemark: line.lineRemark || '',
    shipWarehouse: line.shipWarehouse || '',
    stockQty: line.stockQty ?? null,
    warehouseStockQty: line.warehouseStockQty ?? null,
    variantAttr: '',
  }
  draftLine.variantAttr = resolveDeliveryVariantAttr(draftLine)
  refreshDeliveryLineStock(draftLine)
  return draftLine
}

function refreshPreviewStock() {
  refreshDeliveryLineStock(draft)
}

function recalcPreview() {
  recalcDeliveryLine(draft)
}

function addLot() {
  draft.settlementLots.push(emptySettlementLot())
}

function removeLot(index) {
  draft.settlementLots.splice(index, 1)
  recalcPreview()
}

function onLotBatchChange(lot, id) {
  if (!id) {
    lot.batchNo = ''
    recalcPreview()
    return
  }
  const batch = getMaterialBatch(id)
  if (!batch) return
  lot.batchNo = batch.batchNo || ''
  const content = toContentPercent(batch.content)
  if (content != null) lot.content = content
  if (!(Number(lot.weighQty) > 0)) lot.weighQty = Number(batch.qty) || null
  recalcPreview()
}

function handleCancel() {
  visible.value = false
}

function handleSave() {
  if (props.showShipQty) {
    const shipQty = Number(draft.shipQty)
    if (!shipQty && shipQty !== 0) {
      message.warning('请填写本次发货数量')
      return
    }
    if (shipQty <= 0) {
      message.warning('本次发货数量须大于 0')
      return
    }
    if (shipQty > maxShipQty.value + 1e-9) {
      message.warning(`本次发货数量不能超过可发数量 ${formatDeliveryQty(maxShipQty.value)}`)
      return
    }
  }
  if (contentPricing.value && !contentSettlementReady(draft)) {
    message.warning('请为每个批次填写实测含量和过磅净重')
    return
  }

  recalcDeliveryLine(draft)
  refreshDeliveryLineStock(draft)
  emit('saved', {
    ...props.line,
    shipQty: roundDeliveryDecimal(draft.shipQty, 4),
    shipWeight: roundDeliveryDecimal(draft.shipWeight, 4),
    pricingMode: draft.pricingMode,
    baseContent: draft.baseContent,
    contentStep: draft.contentStep,
    priceStepUp: draft.priceStepUp,
    priceStepDown: draft.priceStepDown,
    taxRate: draft.taxRate,
    baseUnitPriceExTax: roundDeliveryDecimal(draft.baseUnitPriceExTax, 4),
    baseUnitPriceInTax: roundDeliveryDecimal(draft.baseUnitPriceInTax, 4),
    settlementLots: (draft.settlementLots || []).map((lot) => ({ ...lot })),
    settlementText: draft.settlementText || '',
    unitPriceExTax: roundDeliveryDecimal(draft.unitPriceExTax, 4),
    unitPriceInTax: roundDeliveryDecimal(draft.unitPriceInTax, 4),
    deliveryUnitPriceExTax: roundDeliveryDecimal(draft.deliveryUnitPriceExTax, 4),
    deliveryAmountExTax: roundDeliveryDecimal(draft.deliveryAmountExTax, 4),
    deliveryUnitPriceInTax: roundDeliveryDecimal(draft.deliveryUnitPriceInTax, 4),
    deliveryAmountInTax: roundDeliveryDecimal(draft.deliveryAmountInTax, 4),
    packagingForm: draft.packagingForm || '',
    lineRemark: draft.lineRemark || '',
    shipWarehouse: draft.shipWarehouse || '',
    stockQty: draft.stockQty,
    warehouseStockQty: draft.warehouseStockQty,
    variantAttr: draft.variantAttr || '',
  })
  visible.value = false
}
</script>

<style lang="less" scoped>
@import '../../inventory/components/inventoryLineEditModal.less';

.preview-row .preview-label {
  min-width: 7em;
}

.settle-block {
  margin-bottom: 12px;
}

.settle-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.settle-flat {
  margin-bottom: 12px;
}

.lot-card {
  margin-top: 8px;
  padding: 8px 12px 0;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.lot-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
  color: #4e5969;
  font-size: 13px;
}

.settle-sum {
  margin-top: 4px;
  color: #1f2329;
}

.field-hint {
  color: #4e5969;
  font-size: 12px;
  line-height: 20px;
}
</style>
