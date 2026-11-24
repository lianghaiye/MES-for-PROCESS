<template>
  <a-modal
    :open="open"
    title="编辑批次指令"
    :width="520"
    :mask-closable="false"
    destroy-on-close
    @cancel="close"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-row :gutter="[24, 8]" class="confirm-info">
        <a-col :span="24">
          <span class="info-label">主产品：</span>
          <span class="info-value">{{ productText }}</span>
        </a-col>
        <a-col :span="24">
          <span class="info-label">配方：</span>
          <span class="info-value">{{ formulaText }}</span>
        </a-col>
        <a-col :span="24">
          <span class="info-label">下达数量：</span>
          <span class="info-value">{{ qtyText }}</span>
        </a-col>
      </a-row>
    </div>
    <a-form layout="inline" class="horizontal-form">
      <a-row :gutter="[12, 8]" style="width: 100%">
        <a-col :span="24">
          <a-form-item label="批次号" required>
            <a-input v-model:value="batchNo" size="small" allow-clear placeholder="请输入批次号" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="产线">
            <a-select
              v-model:value="productionLineId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="可空，下发前再指定"
              :options="lineOptions"
              style="width: 100%"
            />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="备注" class="remark-item">
            <a-textarea v-model:value="remark" :rows="2" size="small" placeholder="选填" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
    <p class="field-hint">配方和数量沿用生成时的快照。要改这两项，请删除后重新生成。</p>
    <template #footer>
      <a-button @click="close">取消</a-button>
      <a-button type="primary" @click="submit">保存</a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { itemLabel } from '@/store/processFormulaStore'
import { getBatchOrder, isTankChargeOrder, updatePendingOrder } from '@/store/batchInstructionStore'
import { listEnabledProductionLineOptions, productionLineState } from '@/store/productionLineStore'
import { formatQty } from '@/utils/numberFormat'

const props = defineProps({
  open: { type: Boolean, default: false },
  orderId: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'saved'])

const batchNo = ref('')
const productionLineId = ref(undefined)
const remark = ref('')

const order = computed(() => (props.orderId ? getBatchOrder(props.orderId) : null))
const lineOptions = computed(() => {
  void productionLineState.lines
  return listEnabledProductionLineOptions()
})
const productText = computed(() => itemLabel(order.value?.itemId) || '—')
const formulaText = computed(() => {
  const name = order.value?.formulaName || '—'
  const version = order.value?.formulaVersion || ''
  return `${name} ${version}`.trim()
})
const qtyText = computed(() => {
  if (isTankChargeOrder(order.value)) return '待确认'
  return `${formatQty(order.value?.qty)} ${order.value?.unit || ''}`.trim() || '—'
})

watch(
  () => [props.open, props.orderId],
  ([open]) => {
    if (!open) return
    batchNo.value = order.value?.batchNo || ''
    productionLineId.value = order.value?.productionLineId || undefined
    remark.value = order.value?.remark || ''
  },
)

function close() {
  emit('update:open', false)
}

function submit() {
  try {
    updatePendingOrder(props.orderId, {
      batchNo: batchNo.value,
      productionLineId: productionLineId.value,
      remark: remark.value,
    })
    message.success('已保存')
    emit('saved')
    close()
  } catch (error) {
    message.error(error.message || '保存失败')
  }
}
</script>

<style lang="less" scoped>
.confirm-info {
  .info-label {
    color: #4e5969;
    font-size: 14px;
  }

  .info-value {
    color: #1f2329;
    font-size: 14px;
  }
}

.field-hint {
  margin: 8px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}
</style>
