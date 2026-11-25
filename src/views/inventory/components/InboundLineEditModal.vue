<template>
  <a-modal
    :open="open"
    :title="mode === 'copy' ? '复制入库明细' : '编辑入库明细'"
    width="820px"
    :mask-closable="false"
    destroy-on-close
    class="inventory-line-edit-modal"
    @cancel="handleCancel"
  >
    <!-- 与出库明细同壳：纵向标签、820 宽、gutter 16，避免横向紧凑 -->
    <a-form v-if="draft" layout="vertical" class="edit-form">
      <a-form-item>
        <template #label>
          <span class="field-label">
            <FileTextOutlined />
            产品信息
          </span>
        </template>
        <div class="item-preview">
          <div class="preview-grid">
            <div class="preview-row">
              <span class="preview-label">产品编号</span>
              <span>{{ preview?.itemCode || draft.itemCode || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">产品名称</span>
              <span>{{ preview?.itemName || draft.itemName || '—' }}</span>
            </div>
            <div class="preview-row">
              <span class="preview-label">规格型号</span>
              <span>{{ preview?.specModel || draft.specModel || '—' }}</span>
            </div>
          </div>
          <div class="preview-bottom">
            <div class="preview-row">
              <span class="preview-label">库存数量</span>
              <span>
                {{ formatQty(preview?.stockQty ?? draft.stockQty) }}
                {{ preview?.unit || draft.unit || '件' }}
              </span>
            </div>
            <div class="preview-bottom-spacer" />
            <div class="preview-stock-box">
              <div class="stock-value">
                {{ formatQty(preview?.warehouseStockQty ?? draft.warehouseStockQty) }}
              </div>
              <div class="stock-label">当前仓库数量({{ preview?.unit || draft.unit || '件' }})</div>
            </div>
          </div>
        </div>
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item required>
            <template #label>
              <span class="field-label">
                <HomeOutlined />
                位置类型
              </span>
            </template>
            <a-select
              v-model:value="locationType"
              :options="inboundLocationTypeOptions"
              @change="onLocationTypeChange"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item required>
            <template #label>
              <span class="field-label">
                <HomeOutlined />
                入库位置
              </span>
            </template>
            <a-select
              v-model:value="draft.warehouse"
              allow-clear
              show-search
              :placeholder="locationType === 'tank' ? '请选择储罐' : '请选择仓库'"
              :options="warehouseOpts"
              @change="refreshPreviewStock"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <HomeOutlined />
                货位号
              </span>
            </template>
            <a-select
              v-if="locationOpts.length"
              v-model:value="draft.locationNo"
              allow-clear
              show-search
              placeholder="请选择货位"
              :options="locationOpts"
            />
            <a-input
              v-else
              v-model:value="draft.locationNo"
              allow-clear
              placeholder="请输入货位号"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <UnorderedListOutlined />
                有效含量(%)
              </span>
            </template>
            <a-input-number
              :value="contentToPct(draft.content)"
              :min="0"
              :max="100"
              :precision="4"
              placeholder="可按 COA 暂填"
              style="width: 100%"
              @update:value="(v) => (draft.content = contentPctToFraction(v))"
            />
          </a-form-item>
        </a-col>
        <a-col v-if="hasPurchaseAux" :span="8">
          <a-form-item required>
            <template #label>
              <span class="field-label">
                <UnorderedListOutlined />
                点收数量（{{ purchaseUnitLabel }}）
              </span>
            </template>
            <a-input-number
              v-model:value="draft.purchaseQty"
              :min="0.0001"
              :precision="4"
              :formatter="inputNumberFormatter"
              :parser="inputNumberParser"
              :placeholder="`按${purchaseUnitLabel}计`"
              style="width: 100%"
              @change="onPurchaseQtyChange"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item required>
            <template #label>
              <span class="field-label">
                <UnorderedListOutlined />
                入库数量（{{ stockUnitLabel }}）
              </span>
            </template>
            <a-input-number
              v-model:value="draft.qty"
              :min="0.0001"
              :precision="4"
              :formatter="inputNumberFormatter"
              :parser="inputNumberParser"
              placeholder="请填写入库数量"
              style="width: 100%"
              @change="onQtyChange"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <!-- 提示挂在数量行下方，换算工具做成文字链（同出库「自主拣选」） -->
      <div v-if="hasPurchaseAux" class="vl-tip qty-convert-tip">
        <template v-if="convertHint">{{ convertHint }}。</template>
        点收按采购单位，入库按库存单位；有默认换算率时可预填，也可改。
        <a class="manual-pick-inline" @click="openConvertTool">换算工具</a>
      </div>

      <a-row v-if="hasSettleUnitLine" :gutter="16">
        <a-col :span="24">
          <InboundSettleQtyEditor :line="draft" @patch="onSettlePatch" />
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <DollarOutlined />
                {{ costPriceLabel }}
              </span>
            </template>
            <a-input-number
              v-model:value="draft.unitPrice"
              :min="0"
              :precision="2"
              placeholder="请输入"
              style="width: 100%"
              @change="onUnitPriceChange"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item>
            <template #label>
              <span class="field-label">
                <AccountBookOutlined />
                总价
              </span>
            </template>
            <a-input-number :value="draft.totalPrice" :precision="2" disabled style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <!-- 与配方编辑同款：体积/质量 → 公斤，可填入入库数量 -->
    <a-modal
      v-model:open="convertOpen"
      title="换算工具"
      :width="520"
      :mask-closable="true"
      destroy-on-close
      :z-index="1100"
    >
      <div class="mode-switch">
        <div class="mode-switch-label">换算方式</div>
        <a-radio-group
          v-model:value="convertDraft.unit"
          option-type="button"
          button-style="solid"
          size="small"
          :options="feedConvertUnitOptions"
        />
        <div class="mode-switch-hint">{{ convertModeHint }}</div>
      </div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="数量">
              <a-input-number
                v-model:value="convertDraft.qty"
                size="small"
                :min="0"
                :addon-after="convertUnitAddon"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col v-if="convertDraft.unit !== 'g'" :span="12">
            <a-form-item label="密度">
              <a-input-number
                v-model:value="convertDraft.density"
                size="small"
                :min="0"
                addon-after="kg/L"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <div class="convert-result-card">
        <span class="convert-result-label">折合公斤</span>
        <span class="convert-result-value">{{ convertKgText }}</span>
      </div>
      <p class="convert-tip">
        可把结果填入「入库数量」。若换算方式为升且点收单位也是升，会同步点收数量。
      </p>
      <template #footer>
        <a-button @click="convertOpen = false">关闭</a-button>
        <a-button type="primary" :disabled="!(convertKgNum > 0)" @click="applyConvertToInbound">
          填入入库数量
        </a-button>
      </template>
    </a-modal>

    <template #footer>
      <a-button @click="handleCancel">取消</a-button>
      <a-button type="primary" @click="handleOk">确定</a-button>
    </template>
  </a-modal>
</template>

<script setup>
/**
 * 入库明细编辑：采购辅助单位用点收+入库两列；样式沿用原图标标签；
 * 提供与配方页同款的体积/质量换算工具。
 */
import { formatNumber, inputNumberFormatter, inputNumberParser } from '@/utils/numberFormat'
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AccountBookOutlined,
  DollarOutlined,
  FileTextOutlined,
  HomeOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons-vue'
import { warehouseState } from '@/store/warehouseStore'
import { materialBatchState } from '@/store/materialBatchStore'
import {
  getInboundLocationSelectOptions,
  inboundLocationTypeOptions,
  INBOUND_LOCATION_TYPE,
  resolveInboundLocationType,
} from '@/utils/inboundBatchDisplay'
import { getLocationSelectOptions, warehouseLocationState } from '@/store/warehouseLocationStore'
import {
  enrichInboundLine,
  isInboundDualUnitLine,
  syncInboundLineTotalFromUnit,
  validateSettleEntry,
} from '@/utils/inboundLineHelpers'
import InboundSettleQtyEditor from './InboundSettleQtyEditor.vue'
import { hasSettleUnit } from '@/utils/settleUnit'
import { contentPctToFraction, contentToPct } from '@/utils/batchContent'
import { materialInfoState } from '@/store/materialInfoStore'
import {
  purchaseQtyToStockQty,
  resolveInventoryUnit,
  resolvePurchaseConvertRate,
  resolvePurchaseUnit,
} from '@/utils/purchaseUomConvert'
import { convertToFeedKg } from '@/utils/processBatchMath'

function formatQty(val) {
  return formatNumber(val, 4, { empty: '0' })
}

const props = defineProps({
  open: Boolean,
  line: { type: Object, default: null },
  mode: { type: String, default: 'edit' },
})

const emit = defineEmits(['update:open', 'confirm'])

const draft = ref(null)
const preview = ref(null)
const locationType = ref(INBOUND_LOCATION_TYPE.WAREHOUSE)

const warehouseOpts = computed(() => {
  void warehouseState.warehouses
  void materialBatchState.tanks
  return getInboundLocationSelectOptions(locationType.value)
})

function onLocationTypeChange() {
  const allowed = new Set(warehouseOpts.value.map((o) => o.value))
  if (draft.value?.warehouse && !allowed.has(draft.value.warehouse)) {
    draft.value.warehouse = undefined
  }
}

const locationOpts = computed(() => {
  void warehouseLocationState.locations
  return getLocationSelectOptions(draft.value?.warehouse)
})

const resolvedMaterial = computed(() => {
  const code = draft.value?.itemCode
  if (!code) return null
  return materialInfoState.materials.find((m) => m.code === code) || null
})

/** 采购单位 ≠ 库存单位 → 点收 + 入库两列 */
const hasPurchaseAux = computed(() =>
  isInboundDualUnitLine(draft.value || {}, resolvedMaterial.value),
)

const hasSettleUnitLine = computed(() => hasSettleUnit(draft.value || {}))

const stockUnitLabel = computed(() => {
  const mat = resolvedMaterial.value
  return draft.value?.stockUnit || resolveInventoryUnit(mat || {}) || draft.value?.unit || '件'
})

const purchaseUnitLabel = computed(() => {
  const mat = resolvedMaterial.value
  return draft.value?.purchaseUnit || resolvePurchaseUnit(mat || {}) || '件'
})

const convertRate = computed(() =>
  resolvePurchaseConvertRate(resolvedMaterial.value || draft.value || {}),
)

const convertHint = computed(() => {
  const rate = convertRate.value
  if (!(rate > 0)) return ''
  return `换算：1 ${purchaseUnitLabel.value} = ${rate} ${stockUnitLabel.value}`
})

const costPriceLabel = computed(() =>
  hasSettleUnitLine.value ? `入库成本价（元/${draft.value?.settleUnit || 'kg'}）` : '入库成本价',
)

// —— 换算工具（对齐 FormulaEditView）——
const feedConvertUnitOptions = [
  { value: 'g', label: '克' },
  { value: 'mL', label: '毫升' },
  { value: 'L', label: '升' },
]
const convertOpen = ref(false)
const convertDraft = reactive({ qty: null, unit: 'L', density: null })
const convertUnitAddon = computed(() => ({ g: 'g', mL: 'mL', L: 'L' })[convertDraft.unit] || 'g')
const convertModeHint = computed(() => {
  if (convertDraft.unit === 'g') return '1000 g = 1 kg，不使用密度'
  if (convertDraft.unit === 'mL') return '公斤 = 毫升 × 密度（kg/L）÷ 1000'
  return '公斤 = 升 × 密度（kg/L）'
})
const convertKgNum = computed(() =>
  convertToFeedKg(convertDraft.qty, convertDraft.unit, convertDraft.density),
)
const convertKgText = computed(() => {
  const kg = convertKgNum.value
  return kg == null ? '—' : `${formatNumber(kg, 4)} kg`
})

/** 打开换算工具：预填密度、点收升数 */
function openConvertTool() {
  const mat = resolvedMaterial.value || {}
  const density = Number(mat.density ?? convertRate.value)
  convertDraft.density = density > 0 ? density : null
  // 点收单位是升时，用点收数量作默认体积
  const pur = String(purchaseUnitLabel.value || '')
  if (pur === '升' || pur === 'L' || pur === 'l') {
    convertDraft.unit = 'L'
    convertDraft.qty = Number(draft.value?.purchaseQty) > 0 ? Number(draft.value.purchaseQty) : null
  } else {
    convertDraft.unit = 'L'
    convertDraft.qty = null
  }
  convertOpen.value = true
}

/** 折合公斤写入入库数量；升↔点收同步 */
function applyConvertToInbound() {
  const kg = convertKgNum.value
  if (!(kg > 0) || !draft.value) {
    message.warning('请先填写有效数量与密度')
    return
  }
  draft.value.qty = kg
  // 换算按「升」且点收也是升：同步点收，避免两列对不上
  const pur = String(purchaseUnitLabel.value || '')
  if (
    convertDraft.unit === 'L' &&
    (pur === '升' || pur === 'L' || pur === 'l') &&
    Number(convertDraft.qty) > 0
  ) {
    draft.value.purchaseQty = Number(convertDraft.qty)
  }
  syncInboundLineTotalFromUnit(draft.value)
  convertOpen.value = false
  message.success('已填入入库数量')
}

watch(
  () => props.open,
  (visible) => {
    if (!visible || !props.line) {
      draft.value = null
      preview.value = null
      convertOpen.value = false
      return
    }
    const next = enrichInboundLine({ ...props.line })
    const mat = materialInfoState.materials.find((m) => m.code === next.itemCode)
    const inv = resolveInventoryUnit(mat || next)
    const pur = resolvePurchaseUnit(mat || next)
    next.unit = inv
    next.stockUnit = inv
    // 固定换算入库不再走旧「按件填法」
    next.inboundEntryMode = undefined
    if (pur && inv && pur !== inv) {
      next.purchaseUnit = pur
      next.isVariableLength = true
      const rate = resolvePurchaseConvertRate(mat || {})
      next.purchaseConvertRate = rate
      if (!(Number(next.qty) > 0) && Number(next.purchaseQty) > 0 && rate) {
        next.qty = purchaseQtyToStockQty(next.purchaseQty, rate)
      }
    } else {
      next.isVariableLength = false
    }
    draft.value = reactive(next)
    locationType.value = resolveInboundLocationType(next.warehouse)
    refreshPreviewStock()
  },
)

/** 点收变更：有固定换算率则预填入库数量 */
function onPurchaseQtyChange() {
  if (!draft.value) return
  const rate = convertRate.value
  if (rate != null && Number(draft.value.purchaseQty) > 0) {
    draft.value.qty = purchaseQtyToStockQty(draft.value.purchaseQty, rate)
  }
  syncInboundLineTotalFromUnit(draft.value)
}

function refreshPreviewStock() {
  if (!draft.value) return
  Object.assign(draft.value, enrichInboundLine(draft.value))
  preview.value = {
    itemCode: draft.value.itemCode,
    itemName: draft.value.itemName,
    specModel: draft.value.specModel,
    unit: draft.value.unit || '件',
    stockQty: draft.value.stockQty,
    warehouseStockQty: draft.value.warehouseStockQty,
  }
}

function onQtyChange() {
  if (!draft.value) return
  syncInboundLineTotalFromUnit(draft.value)
}

function onUnitPriceChange() {
  if (!draft.value) return
  syncInboundLineTotalFromUnit(draft.value)
}

function onSettlePatch(partial) {
  if (!draft.value) return
  Object.assign(draft.value, partial || {})
  syncInboundLineTotalFromUnit(draft.value)
}

function handleCancel() {
  emit('update:open', false)
}

function handleOk() {
  if (!draft.value) return
  if (!draft.value.itemCode) {
    message.warning('产品信息缺失')
    return
  }
  if (!draft.value.warehouse) {
    message.warning('请选择入库位置')
    return
  }
  if (hasPurchaseAux.value) {
    if (!(Number(draft.value.purchaseQty) > 0)) {
      message.warning(`请填写点收数量（${purchaseUnitLabel.value}）`)
      return
    }
  }
  if (!(Number(draft.value.qty) > 0)) {
    message.warning(`请填写入库数量（${stockUnitLabel.value}）`)
    return
  }
  // 固定换算行：清掉旧按件字段，避免落库脏数据
  draft.value.inboundEntryMode = undefined
  draft.value.pieceValues = undefined
  draft.value.uniformValue = undefined
  draft.value.totalValue = undefined

  if (hasSettleUnit(draft.value)) {
    const settleCheck = validateSettleEntry(draft.value)
    if (!settleCheck.ok) {
      message.warning(settleCheck.message)
      return
    }
  }
  syncInboundLineTotalFromUnit(draft.value)
  emit('confirm', enrichInboundLine({ ...draft.value }))
  emit('update:open', false)
}
</script>

<style lang="less" scoped>
@import './inventoryLineEditModal.less';

.vl-tip {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.45);
}

.qty-convert-tip {
  margin: -4px 0 16px;
}

.manual-pick-inline {
  margin-left: 8px;
  color: #1677ff;
  cursor: pointer;
}

.mode-switch {
  margin-bottom: 12px;
}
.mode-switch-label {
  margin-bottom: 6px;
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
}
.mode-switch-hint,
.convert-tip {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: rgba(0, 0, 0, 0.45);
}
.convert-result-card {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 12px;
  padding: 10px 12px;
  background: #e7f2f0;
  border: 1px solid #a9c6c2;
  border-radius: 6px;
}
.convert-result-label {
  color: rgba(0, 0, 0, 0.45);
  font-size: 13px;
}
.convert-result-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 16px;
  font-weight: 600;
}
</style>
