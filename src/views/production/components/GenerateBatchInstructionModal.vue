<template>
  <a-modal
    :open="open"
    title="生成批次指令"
    :width="960"
    :mask-closable="false"
    destroy-on-close
    @cancel="emit('update:open', false)"
  >
    <div class="modal-basic-card">
      <div class="section-title">基本信息</div>
      <a-form layout="inline" class="horizontal-form">
        <a-row :gutter="[12, 8]" style="width: 100%">
          <a-col :span="8">
            <a-form-item label="生产计划">
              <FeedPlanSelect
                v-model="feedPlanId"
                modal-title="选择生产计划"
                placeholder="可选，选后带出产品与配方"
                @change="onPlanChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="主产品" required>
              <MasterItemSelect
                v-model="itemId"
                catalog="product"
                modal-title="选择主产品"
                placeholder="输入编码或名称"
                :disabled="Boolean(feedPlanId)"
                @change="onProductChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="配方" required>
              <FeedPlanSearchSelect
                v-model="formulaId"
                title="选择配方"
                :placeholder="itemId ? '输入编号或名称' : '先选主产品'"
                :options="formulaOptions"
                :disabled="!itemId || Boolean(feedPlanId)"
                @change="onFormulaChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="基准批量">
              <a-input :value="baseText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="8">
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
              />
            </a-form-item>
          </a-col>
          <a-col v-if="feedPlanId" :span="8">
            <a-form-item label="计划剩余">
              <a-input :value="planRemainingText" size="small" disabled />
            </a-form-item>
          </a-col>
          <a-col v-if="selectedFormula" :span="24">
            <div class="plan-metric-bar">
              <div class="plan-metric-item">
                <div class="plan-metric-label">主原料</div>
                <div class="plan-metric-value">{{ selectedMaterials }}</div>
              </div>
              <div class="plan-metric-item">
                <div class="plan-metric-label">理论得率</div>
                <div class="plan-metric-value">{{ theoreticalYieldText }}</div>
              </div>
              <div class="plan-metric-item">
                <div class="plan-metric-label">理论产出</div>
                <div class="plan-metric-value accent">{{ theoreticalOutputText }}</div>
              </div>
            </div>
          </a-col>
          <a-col :span="24">
            <a-form-item label="拆分方式">
              <a-radio-group v-model:value="splitMode" size="small" @change="refreshPreview">
                <a-radio-button value="by_count">按张数</a-radio-button>
                <a-radio-button value="by_qty">按投料量</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col v-if="splitMode === 'by_count'" :span="8">
            <a-form-item label="张数" required>
              <a-input-number
                v-model:value="batchCount"
                size="small"
                :min="1"
                :max="200"
                style="width: 100%"
                @change="refreshPreview"
              />
            </a-form-item>
          </a-col>
          <template v-else>
            <a-col :span="8">
              <a-form-item label="本次投料量" required>
                <a-input-number
                  v-model:value="demandQty"
                  size="small"
                  :min="0.001"
                  :step="0.001"
                  :formatter="inputNumberFormatter"
                  :parser="inputNumberParser"
                  addon-after="kg"
                  style="width: 100%"
                  @change="refreshPreview"
                />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="向上取整">
                <a-switch v-model:checked="ceil" size="small" @change="refreshPreview" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="预计张数">
                <a-input :value="String(preview.length || 0)" size="small" disabled />
              </a-form-item>
            </a-col>
          </template>
          <a-col :span="24">
            <a-form-item label="来源单号">
              <a-input
                v-model:value="sourceLabel"
                size="small"
                allow-clear
                placeholder="订单号 / 补货单号等，可空"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" class="remark-item">
              <a-textarea
                v-model:value="remark"
                :rows="2"
                size="small"
                placeholder="写入本次生成的每张批次指令"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </div>

    <div class="section-title lines-title">指令明细</div>
    <a-table
      size="small"
      :columns="columns"
      :data-source="displayLines"
      :pagination="false"
      row-key="key"
      :scroll="{ y: 320 }"
      :locale="{ emptyText: '请先选择主产品与配方，并填写数量' }"
    >
      <template #bodyCell="{ column, record, index }">
        <template v-if="column.key === 'seq'">{{ preview.length - index }}</template>
        <template v-else-if="column.key === 'batchNo'">
          <a-input
            v-model:value="record.batchNo"
            size="small"
            allow-clear
            placeholder="按编码规则预填"
          />
        </template>
        <template v-else-if="column.key === 'qty'">
          <a-input-number
            v-model:value="record.qty"
            size="small"
            :min="0.001"
            :step="0.001"
            :formatter="inputNumberFormatter"
            :parser="inputNumberParser"
            style="width: 100%"
            @change="() => onQtyChange(record)"
          />
        </template>
        <template v-else-if="column.key === 'note'">{{ noteOf(record.qty) }}</template>
      </template>
    </a-table>
    <div class="split-hint">{{ hint }}</div>

    <template #footer>
      <a-button @click="emit('update:open', false)">取消</a-button>
      <a-button type="primary" :loading="saving" :disabled="!preview.length" @click="submit">
        生成 ({{ preview.length }})
      </a-button>
    </template>
  </a-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { round3, splitPlanFeedQty, theoreticalOutput } from '@/utils/processBatchMath'
import { inputNumberFormatter, inputNumberParser } from '@/utils/numberFormat'
import { getFormula, itemLabel, itemUnit, listFormulas } from '@/store/processFormulaStore'
import { createTankChargeFromPlan, previewNextBatchNos } from '@/store/batchInstructionStore'
import {
  executeFeedPlan,
  getFeedPlan,
  mainRawMaterialIds,
  planFeedCoverage,
} from '@/store/feedPlanStore'
import {
  formatWorkCenterLabel,
  listEnabledWorkCenters,
  workCenterState,
} from '@/store/workCenterStore'
import { FEED_PLAN_PERIOD_LABEL } from '@/utils/feedPlanPeriod'
import MasterItemSelect from '@/views/product-process/components/MasterItemSelect.vue'
import FeedPlanSearchSelect from '@/views/planning/components/FeedPlanSearchSelect.vue'
import FeedPlanSelect from '@/views/planning/components/FeedPlanSelect.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  presetDemand: { type: Number, default: null },
  presetSource: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'created'])

const feedPlanId = ref()
const itemId = ref()
const formulaId = ref()
const demandQty = ref(100)
const batchCount = ref(1)
const splitMode = ref('by_count')
const ceil = ref(false)
const sourceLabel = ref('')
const remark = ref('')
const workCenterId = ref(undefined)
const saving = ref(false)
const preview = ref([])
let previewKey = 0

const formulaOptions = computed(() => {
  if (!itemId.value) return []
  const rows = listFormulas().filter(
    (row) => row.status === 'active' && row.itemId === itemId.value,
  )
  return rows
    .slice()
    .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)))
    .map((row) => {
      const mark = row.isDefault ? '（默认）' : ''
      return {
        value: row.id,
        label: `${row.formulaNo || row.id} ${row.name || ''}${mark}`.trim(),
      }
    })
})
const selectedFormula = computed(() => (formulaId.value ? getFormula(formulaId.value) : null))
const selectedPlan = computed(() => (feedPlanId.value ? getFeedPlan(feedPlanId.value) : null))
const workCenterLocked = computed(() =>
  Boolean(String(selectedPlan.value?.workCenterId || '').trim()),
)
const workCenterOptions = computed(() => {
  void workCenterState.centers
  const rows = listEnabledWorkCenters().map((row) => ({
    value: row.id,
    label: `${row.code || ''} ${row.name || ''}`.trim(),
  }))
  const lockedId = String(selectedPlan.value?.workCenterId || '').trim()
  if (lockedId && !rows.some((row) => row.value === lockedId)) {
    rows.unshift({
      value: lockedId,
      label: formatWorkCenterLabel(lockedId),
    })
  }
  return rows
})
const planCoverage = computed(() =>
  feedPlanId.value ? planFeedCoverage(feedPlanId.value) : { remaining: 0 },
)
const baseQty = computed(() => Number(selectedFormula.value?.baseBatchQty) || 0)
const baseText = computed(() => (baseQty.value > 0 ? `${baseQty.value} kg` : '—'))
const planRemainingText = computed(() => `${round3(planCoverage.value.remaining) || 0} kg`)
const sumQty = computed(() =>
  round3(preview.value.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)),
)
const selectedMaterials = computed(() => {
  const ids = mainRawMaterialIds(selectedFormula.value)
  return ids.length ? ids.map((id) => itemLabel(id)).join('、') : '—'
})
const feedUnit = computed(() => {
  const ids = mainRawMaterialIds(selectedFormula.value)
  return ids.length ? itemUnit(ids[0]) : 'kg'
})
const outputUnit = computed(() =>
  selectedFormula.value?.itemId ? itemUnit(selectedFormula.value.itemId) : feedUnit.value,
)
const theoreticalYieldText = computed(() => {
  const rate = Number(selectedFormula.value?.theoreticalYield)
  if (!Number.isFinite(rate) || rate < 0) return '—'
  return rate <= 1 ? `${Math.round(rate * 1000) / 10}%` : String(rate)
})
const metricFeedQty = computed(() => {
  if (sumQty.value > 0) return sumQty.value
  if (splitMode.value === 'by_qty') return Number(demandQty.value) || 0
  if (baseQty.value > 0) return round3(batchCount.value * baseQty.value)
  return 0
})
const theoreticalOutputText = computed(() => {
  const formula = selectedFormula.value
  const qty = metricFeedQty.value
  if (!formula || !(qty > 0) || !Number.isFinite(Number(formula.theoreticalYield))) return '—'
  return `${theoreticalOutput(qty, formula.theoreticalYield)} ${outputUnit.value}`
})
const columns = [
  { title: '序号', key: 'seq', width: 56, align: 'center' },
  { title: '批次号', key: 'batchNo', width: 180 },
  { title: '计划投料量 (kg)', key: 'qty', width: 150 },
  { title: '说明', key: 'note' },
]
/** 倒序展示，余数/取整补足行固定在顶部可见。提交仍按拆分顺序。 */
const displayLines = computed(() => preview.value.slice().reverse())
const hint = computed(() => {
  if (!selectedFormula.value) return '请先选择主产品与配方。'
  const planTip = feedPlanId.value ? '将挂到所选生产计划。' : '未选生产计划时按手工需求生成。'
  if (splitMode.value === 'by_qty') {
    return ceil.value
      ? `${planTip}按投料量拆分，余数不足一个基准批量时向上取整为完整批量。本次合计 ${sumQty.value} kg。批次号已按编码规则预填，可改。`
      : `${planTip}按投料量拆分，整批等于基准批量，余数单独一张。本次合计 ${sumQty.value} kg。批次号已按编码规则预填，可改。`
  }
  return `${planTip}按张数拆分。本次合计 ${sumQty.value} kg。批次号已按编码规则预填，可改；清空后提交时再自动生成。`
})

watch(
  () => props.open,
  (val) => {
    if (!val) return
    resetForm()
  },
)

function resetForm() {
  feedPlanId.value = undefined
  itemId.value = undefined
  formulaId.value = undefined
  demandQty.value = props.presetDemand || 100
  batchCount.value = 1
  splitMode.value = 'by_count'
  ceil.value = false
  sourceLabel.value = props.presetSource || ''
  remark.value = ''
  workCenterId.value = undefined
  preview.value = []
}

function formulasOfProduct(productId) {
  return listFormulas().filter((row) => row.status === 'active' && row.itemId === productId)
}

function noteOf(qty) {
  const base = baseQty.value
  const value = Number(qty)
  if (!(value > 0)) return '请填写计划投料量'
  if (!(base > 0)) return '按填写数量'
  if (Math.abs(value - base) < 1e-9) return '基准批量'
  if (value < base) return '不足一个基准批量'
  return '超过基准批量'
}

function onPlanChange() {
  const plan = selectedPlan.value
  if (!plan) {
    workCenterId.value = undefined
    refreshPreview()
    return
  }
  const formula = getFormula(plan.formulaId)
  itemId.value = plan.itemId || formula?.itemId
  formulaId.value = plan.formulaId
  workCenterId.value = plan.workCenterId || undefined
  const remaining = planFeedCoverage(plan.id).remaining
  if (remaining > 0) demandQty.value = remaining
  const typeLabel = FEED_PLAN_PERIOD_LABEL[plan.periodType] || '计划'
  sourceLabel.value =
    props.presetSource || `${typeLabel} ${plan.periodLabel || plan.planNo || ''}`.trim()
  if (formula?.baseBatchQty > 0 && demandQty.value > 0) {
    batchCount.value = Math.max(
      1,
      splitPlanFeedQty(demandQty.value, formula.baseBatchQty, { ceil: false }).length,
    )
  }
  refreshPreview()
}

function onProductChange() {
  if (feedPlanId.value) return
  const rows = formulasOfProduct(itemId.value)
  const picked = rows.find((row) => row.isDefault) || (rows.length === 1 ? rows[0] : null)
  formulaId.value = picked?.id
  refreshPreview()
}

function onFormulaChange() {
  refreshPreview()
}

function nextPreviewRow(qty, batchNo = '') {
  previewKey += 1
  return {
    key: previewKey,
    batchNo: batchNo || '',
    qty: round3(qty),
  }
}

/** 空批次号按编码规则预填；已有内容保留。 */
function withPrefillBatchNos(rows) {
  const list = Array.isArray(rows) ? rows : []
  const emptyIdx = []
  list.forEach((row, index) => {
    if (!String(row.batchNo || '').trim()) emptyIdx.push(index)
  })
  if (!emptyIdx.length) return list
  const exclude = list.map((row) => String(row.batchNo || '').trim()).filter(Boolean)
  const nos = previewNextBatchNos(emptyIdx.length, { exclude })
  emptyIdx.forEach((index, i) => {
    list[index].batchNo = nos[i] || ''
  })
  return list
}

function onQtyChange(record) {
  record.qty = round3(record.qty)
}

function refreshPreview() {
  const formula = selectedFormula.value
  const prev = preview.value.slice()
  if (!formula || formula.status !== 'active') {
    preview.value = []
    return
  }
  const base = Number(formula.baseBatchQty) || 0
  let rows = []
  if (splitMode.value === 'by_count') {
    const n = Math.max(1, Math.min(200, Number(batchCount.value) || 1))
    batchCount.value = n
    if (!(base > 0)) {
      preview.value = []
      return
    }
    rows = Array.from({ length: n }, (_, index) => nextPreviewRow(base, prev[index]?.batchNo || ''))
  } else {
    const qty = Number(demandQty.value)
    if (!(qty > 0) || !(base > 0)) {
      preview.value = []
      return
    }
    rows = splitPlanFeedQty(qty, base, { ceil: ceil.value }).map((row, index) =>
      nextPreviewRow(row.qty, prev[index]?.batchNo || ''),
    )
  }
  preview.value = withPrefillBatchNos(rows)
}

function submit() {
  if (!itemId.value) {
    message.warning('请选择主产品')
    return
  }
  const formula = selectedFormula.value
  if (!formula || formula.status !== 'active') {
    message.warning('请选择生效配方')
    return
  }
  if (!preview.value.length) {
    message.warning('没有可生成的批次')
    return
  }
  const qtys = preview.value.map((row) => Number(row.qty))
  if (qtys.some((qty) => !(qty > 0))) {
    message.warning('每张计划投料量都要大于 0')
    return
  }
  const batchNos = preview.value.map((row) => String(row.batchNo || '').trim())
  const seen = new Set()
  for (const no of batchNos) {
    if (!no) continue
    if (seen.has(no)) {
      message.warning(`批次号「${no}」重复`)
      return
    }
    seen.add(no)
  }
  saving.value = true
  try {
    let created
    const remarkText = String(remark.value || '').trim()
    if (feedPlanId.value) {
      created = executeFeedPlan(feedPlanId.value, {
        qtys,
        batchNos,
        workCenterId: workCenterId.value || '',
        ceil: splitMode.value === 'by_qty' ? ceil.value : false,
        remark: remarkText,
      })
    } else {
      created = preview.value.map((row, index) =>
        createTankChargeFromPlan({
          formulaId: formulaId.value,
          workCenterId: workCenterId.value || '',
          sourceLabel: sourceLabel.value || '手工需求',
          plannedQty: row.qty,
          seq: index + 1,
          batchCount: preview.value.length,
          batchNo: batchNos[index],
          remark: remarkText,
        }),
      )
    }
    message.success(`已生成 ${created.length} 张批次指令`)
    emit('created', created)
    emit('update:open', false)
  } catch (error) {
    message.error(error.message || '生成失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.section-title {
  margin-bottom: 8px;
  color: #1f2329;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.lines-title {
  margin-top: 12px;
}

.split-hint {
  margin-top: 8px;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.plan-metric-bar {
  display: flex;
  margin: 4px 0 8px;
  padding: 12px 4px;
  background: linear-gradient(180deg, #f7f9fc 0%, #f5f5f5 100%);
  border: 1px solid #ebedf0;
  border-radius: 8px;
}

.plan-metric-item {
  flex: 1;
  min-width: 0;
  padding: 0 16px;
  border-right: 1px solid #e8e8e8;

  &:last-child {
    border-right: none;
  }
}

.plan-metric-label {
  margin-bottom: 6px;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 1.4;
}

.plan-metric-value {
  color: rgba(0, 0, 0, 0.88);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-all;

  &.accent {
    color: #307068;
  }
}
</style>
