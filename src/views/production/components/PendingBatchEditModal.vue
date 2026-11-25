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
          <a-form-item label="工作中心">
            <a-select
              v-model:value="workCenterId"
              size="small"
              allow-clear
              show-search
              option-filter-prop="label"
              placeholder="可不选"
              :options="workCenterOptions"
              :disabled="workCenterLocked"
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
    <p class="field-hint">
      配方沿用生成时的快照。计划已指定工作中心时不可改；下达数量请在「指定下发」时调整，要改配方请删除后重新生成。
    </p>
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
import { getFeedPlan } from '@/store/feedPlanStore'
import {
  formatWorkCenterLabel,
  listEnabledWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'
import { formatQty } from '@/utils/numberFormat'

const props = defineProps({
  open: { type: Boolean, default: false },
  orderId: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'saved'])

const batchNo = ref('')
const workCenterId = ref(undefined)
const remark = ref('')

const order = computed(() => (props.orderId ? getBatchOrder(props.orderId) : null))
const planWorkCenterId = computed(() => {
  const planId = order.value?.feedPlanId
  if (!planId) return ''
  return String(getFeedPlan(planId)?.workCenterId || '').trim()
})
const workCenterLocked = computed(() => Boolean(planWorkCenterId.value))
const workCenterOptions = computed(() => {
  void workCenterState.centers
  const rows = listEnabledWorkCenters().map((row) => ({
    value: row.id,
    label: `${row.code || ''} ${row.name || ''}`.trim(),
  }))
  const lockedId = String(workCenterId.value || planWorkCenterId.value || '').trim()
  if (lockedId && !rows.some((row) => row.value === lockedId)) {
    rows.unshift({
      value: lockedId,
      label: formatWorkCenterLabel(lockedId),
    })
  }
  return rows
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
    workCenterId.value = order.value?.workCenterId || undefined
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
      workCenterId: workCenterLocked.value ? planWorkCenterId.value : workCenterId.value,
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

.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
}

.field-hint {
  margin: 8px 0 0;
  color: #86909c;
  font-size: 12px;
}
</style>
