<template>
  <a-drawer
    :open="open"
    title="指定下发"
    placement="right"
    :width="drawerWidth"
    :mask-closable="true"
    :mask-style="DRAWER_MASK_STYLE"
    destroy-on-close
    @close="close"
  >
    <div class="section-title">基本信息</div>
    <div class="drawer-basic-card">
      <a-form layout="inline" class="horizontal-form header-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="12">
            <a-form-item label="批次号">
              <a-input :value="text(order?.batchNo)" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="主产品">
              <a-input :value="productText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="配方">
              <a-input :value="formulaText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="工作中心" required>
              <a-select
                v-model:value="workCenterId"
                size="small"
                show-search
                option-filter-prop="label"
                placeholder="请选择工作中心"
                :options="workCenterOptions"
                :disabled="workCenterLocked"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="下达数量" required>
              <a-input-number
                v-model:value="releaseQty"
                size="small"
                :min="0"
                :step="0.001"
                style="width: 100%"
                :addon-after="order?.unit || 'kg'"
                placeholder="请输入"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="理论产出">
              <a-input :value="previewOutputText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="24" class="remark-col">
            <a-form-item label="备注" class="remark-item">
              <a-textarea
                v-model:value="remark"
                size="small"
                :rows="2"
                :auto-size="{ minRows: 2, maxRows: 4 }"
                placeholder="选填"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="section-title route-title">{{ routeTitle }}</div>
    <a-table
      size="small"
      :columns="routeColumns"
      :data-source="stepEdits"
      :pagination="false"
      row-key="key"
      :scroll="{ x: 960 }"
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
        <template v-else-if="column.key === 'gate'">
          <a-tag :color="record.gateHard ? 'warning' : 'default'">{{ record.gateLabel }}</a-tag>
        </template>
        <template v-else-if="column.key === 'assay'">
          <span>{{ record.assayText }}</span>
        </template>
        <template v-else-if="column.key === 'formTemplate'">
          <span>{{ record.formTemplateText }}</span>
        </template>
        <template v-else-if="column.key === 'transfer'">
          <span>{{ record.transferText }}</span>
        </template>
      </template>
    </a-table>
    <p class="field-hint">
      设备、岗位可改；门禁 / 化验 / 过程记录 /
      转移条件来自配方快照，只读对照。确认本步时再从候选设备中选定实际执行台。
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
import { getFormula, itemLabel } from '@/store/processFormulaStore'
import { getProcessById, resolveDefaultExecutors } from '@/store/processConfigStore'
import { deviceLabelById, equipmentState, listDevices } from '@/store/equipmentStore'
import { positionOptions } from '@/store/employeeGroupStore'
import {
  confirmReleaseOrder,
  getBatchOrder,
  isTankChargeOrder,
} from '@/store/batchInstructionStore'
import { getFeedPlan } from '@/store/feedPlanStore'
import {
  formatWorkCenterLabel,
  listEnabledWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'
import { resolveCurrentUserDefaultWorkCenterId } from '@/utils/employeeProfileResolver'
import { EQUIPMENT_STATUS } from '@/mock/equipmentSeed'
import {
  formatProcessGate,
  normalizeProcessGate,
  PROCESS_GATE_HARD,
} from '@/mock/processConfigSeed'
import {
  assayTypeLabel,
  isProcessAssayScheme,
  resolveAssaySchemesForStep,
} from '@/utils/qcProcessConfig'
import { resolveStepFormTemplate } from '@/utils/processFormTemplateSnapshot'
import { theoreticalOutput } from '@/utils/processBatchMath'
import { formatQty } from '@/utils/numberFormat'
import { useDrawerWidth } from '@/composables/useDrawerWidth'
import { DRAWER_MASK_STYLE } from '@/utils/drawerWidth'

const props = defineProps({
  open: { type: Boolean, default: false },
  orderId: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'released'])

const stepEdits = ref([])
const workCenterId = ref(undefined)
const releaseQty = ref(null)
const remark = ref('')
const { isNarrowViewport } = useDrawerWidth('l')
const drawerWidth = computed(() => (isNarrowViewport.value ? '100%' : 960))

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

const previewOutputText = computed(() => {
  const qty = Number(releaseQty.value)
  if (!(qty > 0)) return '—'
  const formula = order.value?.formulaId ? getFormula(order.value.formulaId) : null
  const yieldRate = formula?.theoreticalYield
  if (yieldRate == null || yieldRate === '') {
    const current = Number(order.value?.theoreticalOutput)
    if (current > 0 && Number(order.value?.qty) > 0) {
      return `${formatQty((current * qty) / Number(order.value.qty))} ${order.value?.unit || 'kg'}`
    }
    return '—'
  }
  const out = theoreticalOutput(qty, yieldRate)
  return out == null || out === '' ? '—' : `${formatQty(out)} ${order.value?.unit || 'kg'}`
})

const routeColumns = [
  { title: '步骤', dataIndex: 'stepNo', width: 64 },
  { title: '工序', dataIndex: 'name', width: 110, ellipsis: true },
  { title: '设备', key: 'equipment', width: 200 },
  { title: '岗位', key: 'position', width: 160 },
  { title: '门禁', key: 'gate', width: 88 },
  { title: '过程化验', key: 'assay', width: 160, ellipsis: true },
  { title: '过程记录', key: 'formTemplate', width: 120, ellipsis: true },
  { title: '转移条件', key: 'transfer', width: 120, ellipsis: true },
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

function stepAssayText(step, proc) {
  const schemes = resolveAssaySchemesForStep(step, proc).filter(isProcessAssayScheme)
  if (!schemes.length) return '—'
  return schemes
    .map((scheme) => assayTypeLabel(scheme.assayType, scheme.bizScope) || scheme.name || '化验')
    .join('、')
}

function buildStepEdits() {
  return (order.value?.routeSnapshot || []).map((step, index) => {
    const proc = step.processId ? getProcessById(step.processId) : null
    const savedPositions = Array.isArray(step.positionNames)
      ? step.positionNames.map((name) => String(name || '').trim()).filter(Boolean)
      : []
    const gateMode = normalizeProcessGate(step.gateMode || proc?.gateMode)
    const tpl = resolveStepFormTemplate(step)
    const transfer = String(step.transferCondition || proc?.transferCondition || '').trim()
    return {
      key: `${step.stepNo || index}-${index}`,
      stepNo: step.stepNo || index + 1,
      name: step.name || step.processName || '—',
      processId: step.processId || '',
      equipmentIds: stepEquipmentIds(step),
      positionNames: savedPositions.length ? savedPositions : resolveDefaultExecutors(proc),
      gateHard: gateMode === PROCESS_GATE_HARD,
      gateLabel: formatProcessGate(gateMode).startsWith('硬') ? '硬门禁' : '记录',
      assayText: stepAssayText(step, proc),
      formTemplateText: tpl?.templateName || '—',
      transferText: transfer || '—',
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

const canSubmit = computed(() => {
  if (order.value?.status !== 'pending_release') return false
  if (!String(workCenterId.value || planWorkCenterId.value || '').trim()) return false
  return Number(releaseQty.value) > 0
})

function defaultReleaseWorkCenterId() {
  if (planWorkCenterId.value) return planWorkCenterId.value
  const saved = String(order.value?.workCenterId || '').trim()
  if (saved) return saved
  return resolveCurrentUserDefaultWorkCenterId() || undefined
}

watch(
  () => [props.open, props.orderId],
  ([open]) => {
    if (!open) return
    stepEdits.value = buildStepEdits()
    workCenterId.value = defaultReleaseWorkCenterId()
    remark.value = order.value?.remark || ''
    if (isTankChargeOrder(order.value) || !(Number(order.value?.qty) > 0)) {
      releaseQty.value = null
    } else {
      releaseQty.value = Number(order.value.qty)
    }
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
    const centerId = workCenterLocked.value
      ? planWorkCenterId.value
      : String(workCenterId.value || '').trim()
    if (!centerId) throw new Error('请选择工作中心')
    if (!(Number(releaseQty.value) > 0)) {
      throw new Error('请填写下达数量')
    }
    confirmReleaseOrder(props.orderId, {
      workCenterId: centerId,
      qty: releaseQty.value,
      remark: remark.value,
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

  :deep(.header-form.ant-form-inline) {
    display: block;
    width: 100%;
  }

  :deep(.remark-col) {
    margin-top: 4px;
  }

  /* 备注多行时避免被 inline/small 行高压成 32px，溢出盖住下方区块 */
  :deep(.remark-item) {
    align-items: flex-start;

    .ant-form-item-row {
      align-items: flex-start;
    }

    .ant-form-item-control,
    .ant-form-item-control-input,
    .ant-form-item-control-input-content {
      height: auto !important;
      min-height: 0;
      overflow: visible;
    }

    .ant-input-textarea,
    textarea.ant-input {
      height: auto !important;
      min-height: 54px;
      resize: none;
    }
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
  clear: both;
}
</style>
