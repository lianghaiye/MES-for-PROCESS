<template>
  <a-drawer
    :open="open"
    title="指定下发"
    placement="right"
    :width="drawerWidth"
    :mask-closable="false"
    :mask-style="DRAWER_MASK_STYLE"
    destroy-on-close
    @close="close"
  >
    <div class="section-title">基本信息</div>
    <div class="drawer-basic-card">
      <a-row :gutter="[24, 8]" class="drawer-basic-info">
        <a-col :span="12">
          <span class="info-label">批次号：</span>
          <span class="info-value">{{ text(order?.batchNo) }}</span>
        </a-col>
        <a-col :span="12">
          <span class="info-label">主产品：</span>
          <span class="info-value">{{ productText }}</span>
        </a-col>
        <a-col :span="12">
          <span class="info-label">配方：</span>
          <span class="info-value">{{ formulaText }}</span>
        </a-col>
        <a-col :span="12">
          <span class="info-label">下达数量：</span>
          <span class="info-value">{{ qtyText }}</span>
        </a-col>
      </a-row>
    </div>

    <div class="section-title route-title">{{ routeTitle }}</div>
    <a-table
      size="small"
      :columns="routeColumns"
      :data-source="stepEdits"
      :pagination="false"
      row-key="key"
      :locale="{ emptyText: '这张指令没有工艺步骤' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'equipment'">
          <a-select
            v-model:value="record.equipmentIds"
            mode="multiple"
            size="small"
            allow-clear
            show-search
            option-filter-prop="label"
            :max-tag-count="1"
            placeholder="可不选"
            :options="equipmentOptions(record)"
            style="width: 100%"
          />
        </template>
        <template v-else-if="column.key === 'position'">
          <a-select
            v-model:value="record.positionNames"
            mode="multiple"
            size="small"
            allow-clear
            show-search
            option-filter-prop="label"
            :max-tag-count="1"
            placeholder="请选择岗位"
            :options="positionSelectOptions"
            style="width: 100%"
          />
        </template>
      </template>
    </a-table>
    <p class="field-hint">
      设备默认带出配方步骤上的设备，可改成该工序允许的其他设备。岗位默认带出工序的默认岗位，可改。
    </p>

    <template #footer>
      <div class="drawer-footer">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :disabled="!canSubmit" @click="submit">下发</a-button>
      </div>
    </template>
  </a-drawer>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { itemLabel } from '@/store/processFormulaStore'
import { getProcessById, resolveDefaultExecutors } from '@/store/processConfigStore'
import { deviceLabelById } from '@/store/equipmentStore'
import { positionOptions } from '@/store/employeeGroupStore'
import {
  confirmReleaseOrder,
  getBatchOrder,
  isTankChargeOrder,
} from '@/store/batchInstructionStore'
import { equipmentState, listDevices } from '@/store/equipmentStore'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import { formatQty } from '@/utils/numberFormat'
import { useDrawerWidth } from '@/composables/useDrawerWidth'
import { DRAWER_MASK_STYLE } from '@/utils/drawerWidth'

const props = defineProps({
  open: { type: Boolean, default: false },
  orderId: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'released'])

const stepEdits = ref([])
const { isNarrowViewport } = useDrawerWidth('l')
const drawerWidth = computed(() => (isNarrowViewport.value ? '100%' : 960))

const order = computed(() => (props.orderId ? getBatchOrder(props.orderId) : null))

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

const routeColumns = [
  { title: '步骤', dataIndex: 'stepNo', width: 64 },
  { title: '工序', dataIndex: 'name', width: 120, ellipsis: true },
  { title: '设备', key: 'equipment' },
  { title: '岗位', key: 'position', width: 220 },
]

const positionSelectOptions = computed(() => {
  const names = new Set(positionOptions)
  stepEdits.value.forEach((row) => {
    ;(row.positionNames || []).forEach((name) => {
      if (name) names.add(name)
    })
  })
  return [...names].map((name) => ({ value: name, label: name }))
})

const routeTitle = computed(() => {
  const route = order.value?.equipmentRoute
  const name = `${route?.routeCode || ''} ${route?.routeName || ''}`.trim()
  return name ? `工艺执行 · ${name}` : '工艺执行'
})

function equipmentOptions(record) {
  void equipmentState.devices
  const proc = record?.processId ? getProcessById(record.processId) : null
  const allow = proc?.equipmentIds?.length ? new Set(proc.equipmentIds) : null
  const devices = listDevices().filter(
    (device) =>
      device.status !== EQUIPMENT_STATUS.SCRAPPED &&
      device.status !== EQUIPMENT_STATUS.REPAIRING &&
      (!allow || allow.has(device.id)),
  )
  const options = devices.map((device) => ({
    value: device.id,
    label: device.code ? `${device.name}（${device.code}）` : device.name,
  }))
  ;(record?.equipmentIds || []).forEach((id) => {
    if (id && !options.some((item) => item.value === id)) {
      options.unshift({ value: id, label: deviceLabelById(id) || id })
    }
  })
  return options
}

function buildStepEdits() {
  return (order.value?.routeSnapshot || []).map((step, index) => {
    const proc = step.processId ? getProcessById(step.processId) : null
    const savedPositions = Array.isArray(step.positionNames)
      ? step.positionNames.map((name) => String(name || '').trim()).filter(Boolean)
      : []
    return {
      key: `${step.stepNo || index}-${index}`,
      stepNo: step.stepNo || index + 1,
      name: step.name || step.processName || '—',
      processId: step.processId || '',
      equipmentIds: stepEquipmentIds(step),
      positionNames: savedPositions.length ? savedPositions : resolveDefaultExecutors(proc),
    }
  })
}

function stepEquipmentIds(step) {
  const ids = Array.isArray(step?.equipmentIds)
    ? step.equipmentIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []
  const single = String(step?.equipmentId || '').trim()
  if (!ids.length && single) return [single]
  return ids
}

const canSubmit = computed(() => order.value?.status === 'pending_release')

watch(
  () => [props.open, props.orderId],
  ([open]) => {
    if (!open) return
    stepEdits.value = buildStepEdits()
  },
)

function text(value) {
  const raw = value == null ? '' : String(value).trim()
  return raw || '—'
}

function close() {
  emit('update:open', false)
}

function submit() {
  try {
    confirmReleaseOrder(props.orderId, {
      steps: stepEdits.value.map((row) => ({
        stepNo: row.stepNo,
        equipmentIds: row.equipmentIds,
        positionNames: row.positionNames,
      })),
    })
    message.success('已下发')
    emit('released')
    close()
  } catch (error) {
    message.error(error.message || '下发失败')
  }
}
</script>

<style lang="less" scoped>
.section-title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #1f2329;
}

.drawer-basic-card {
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
}

.drawer-basic-info {
  .info-label {
    color: #4e5969;
    font-size: 14px;
  }

  .info-value {
    color: #1f2329;
    font-size: 14px;
  }
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.field-hint {
  margin: 8px 0 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.route-title {
  margin-top: 16px;
}
</style>
